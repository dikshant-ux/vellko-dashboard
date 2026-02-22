"""
Reports router — proxies Cake Marketing API reports.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_active_cake_connection
from models import User, UserRole
from auth import get_current_user
import httpx
import xmltodict
import re as _re

router = APIRouter(prefix="/admin/reports", tags=["reports"])


async def get_report_user(current_user: User = Depends(get_current_user)) -> User:
    """Allow admins OR users with Web Traffic / Both permission."""
    if current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        return current_user
    if getattr(current_user, "application_permission", None) in ["Web Traffic", "Both"]:
        return current_user
    raise HTTPException(status_code=403, detail="Access denied")


def _scalar(d):
    """
    Flatten an xmltodict node to a plain Python scalar.
    Cake wraps values in namespace-aware dicts like:
        {"@xmlns": "API:id_name_store", "#text": "30881"}
    We always want just the text content.
    """
    if d is None:
        return None
    if isinstance(d, dict):
        # xmltodict with namespace attr → {"@xmlns": ..., "#text": value}
        if "#text" in d:
            return d["#text"]
        # Fallback: find the first non-@ key
        for k, v in d.items():
            if not k.startswith("@"):
                return _scalar(v)
        return None
    return d


def _id(store: dict):
    """Extract the ID from a Cake id_name_store container dict."""
    if not isinstance(store, dict):
        return None
    for k, v in store.items():
        if k.startswith("@"):
            continue
        if "id" in k.lower():
            return _scalar(v)
    return None


def _name(store: dict):
    """Extract the name from a Cake id_name_store container dict."""
    if not isinstance(store, dict):
        return str(store) if store else ""
    for k, v in store.items():
        if k.startswith("@"):
            continue
        if "name" in k.lower():
            val = _scalar(v)
            return str(val) if val is not None else ""
    return ""


def _float(v):
    v = _scalar(v) if isinstance(v, dict) else v
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _int(v):
    v = _scalar(v) if isinstance(v, dict) else v
    try:
        return int(float(v))   # float() first handles "0.000" strings
    except (TypeError, ValueError):
        return 0


@router.get("/campaign-summary")
async def get_campaign_summary(
    start_date: str = Query(..., description="Start date MM/DD/YYYY"),
    end_date: str = Query(..., description="End date MM/DD/YYYY (max 1 month range)"),
    campaign_id: int = Query(0, description="0 for all"),
    source_affiliate_id: int = Query(0, description="0 for all"),
    site_offer_id: int = Query(0, description="0 for all"),
    source_affiliate_tag_id: int = Query(0),
    site_offer_tag_id: int = Query(0),
    source_affiliate_manager_id: int = Query(0),
    brand_advertiser_manager_id: int = Query(0),
    event_id: int = Query(0),
    event_type: str = Query("macro_event_conversions", description="all | macro_event_conversions | micro_events"),
    user: User = Depends(get_report_user),
):
    """
    Proxy the Cake CampaignSummary API v5 and return normalised JSON rows.
    Note: Cake enforces a maximum of one month per request.
    """
    cake_conn = await get_active_cake_connection()
    if not cake_conn:
        raise HTTPException(status_code=503, detail="No active Cake connection is configured")

    # Derive the report URL from the configured signup api_url
    base_url = cake_conn.get("api_url", "")
    report_url = _re.sub(r"/api/.*", "/api/5/reports.asmx/CampaignSummary", base_url)

    params = {
        "api_key":                      cake_conn["api_key"],
        "start_date":                   start_date,
        "end_date":                     end_date,
        "campaign_id":                  str(campaign_id),
        "source_affiliate_id":          str(source_affiliate_id),
        "subid_id":                     "",
        "site_offer_id":                str(site_offer_id),
        "source_affiliate_tag_id":      str(source_affiliate_tag_id),
        "site_offer_tag_id":            str(site_offer_tag_id),
        "source_affiliate_manager_id":  str(source_affiliate_manager_id),
        "brand_advertiser_manager_id":  str(brand_advertiser_manager_id),
        "event_id":                     str(event_id),
        "event_type":                   event_type,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(report_url, params=params)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Cake API unreachable: {str(e)}")

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Cake API returned HTTP {response.status_code}: {response.text[:300]}",
        )

    try:
        parsed = xmltodict.parse(response.text)
        root = parsed.get("campaign_summary_response", {})

        success = str(root.get("success", "false")).lower() == "true"
        if not success:
            raise HTTPException(status_code=400, detail="Cake API reported failure in campaign summary response")

        raw_campaigns = root.get("campaigns") or {}
        raw_list = raw_campaigns.get("campaign_summary", [])
        if isinstance(raw_list, dict):
            raw_list = [raw_list]    # single row comes back as a dict

        rows = []
        for r in raw_list:
            campaign   = r.get("campaign") or {}
            affiliate  = r.get("source_affiliate") or {}
            site_offer = r.get("site_offer") or {}
            advertiser = r.get("brand_advertiser") or {}
            aff_mgr    = r.get("source_affiliate_manager") or {}
            adv_mgr    = r.get("brand_advertiser_manager") or {}

            rows.append({
                "campaign_id":             _id(campaign),
                "campaign_name":           _name(campaign),
                "affiliate_id":            _id(affiliate),
                "offer_id":                _id(site_offer),
                "offer_name":              _name(site_offer),
                "advertiser_id":           _id(advertiser),
                "affiliate_manager":       _name(aff_mgr),
                "advertiser_manager":      _name(adv_mgr),
                "price_format":            r.get("price_format", ""),
                "media_type":              r.get("media_type", ""),
                # Traffic
                "views":                   _int(r.get("views")),
                "clicks":                  _int(r.get("clicks")),
                "click_thru_pct":          _float(r.get("click_thru_percentage")),
                # Conversions
                "conversions":             _float(r.get("macro_event_conversions")),
                "conversion_pct":          _float(r.get("macro_event_conversion_percentage")),
                "micro_events":            _float(r.get("micro_events")),
                "paid":                    _float(r.get("paid")),
                "sellable":                _float(r.get("sellable")),
                "pending":                 _float(r.get("pending")),
                "rejected":                _float(r.get("rejected")),
                "approved":                _float(r.get("approved")),
                "returned":                _float(r.get("returned")),
                # Financials
                "cost":                    _float(r.get("cost")),
                "average_cost":            _float(r.get("average_cost")),
                "epc":                     _float(r.get("epc")),
                "revenue":                 _float(r.get("revenue")),
                "revenue_per_transaction": _float(r.get("revenue_per_transaction")),
                "margin":                  _float(r.get("margin")),
                "profit":                  _float(r.get("profit")),
                # Orders
                "orders":                  _int(r.get("orders")),
                "order_total":             _float(r.get("order_total")),
                "total_paid":              _float(r.get("total_paid")),
            })

        return {
            "success": True,
            "row_count": len(rows),
            "rows": rows,
            "_debug_first_raw": raw_list[0] if raw_list else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse Cake response: {str(e)}")
