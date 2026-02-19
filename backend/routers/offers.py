from fastapi import APIRouter, Depends, Query, HTTPException, Request
from typing import Optional, List, Dict, Any
import httpx
import xmltodict
import math
from pydantic import BaseModel
from database import db, settings, get_active_cake_connection

router = APIRouter(
    prefix="/offers",
    tags=["offers"],
    responses={404: {"description": "Not found"}},
)

# Pydantic models for response structure (optional but good for docs)
class Offer(BaseModel):
    site_offer_id: str
    site_offer_name: str
    third_party_name: Optional[str] = None
    brand_advertiser_name: Optional[str] = None
    vertical_name: Optional[str] = None
    site_offer_status_name: Optional[str] = None
    hidden: Optional[str] = None
    site_offer_link: Optional[str] = None
    payout: Optional[str] = None
    price_format: Optional[str] = None
    brand_advertiser_id: Optional[str] = None
    # Add other fields as needed for the table

class OffersResponse(BaseModel):
    success: bool
    row_count: int
    offers: List[Dict[str, Any]]
    page: int
    limit: int
    total_pages: int

@router.get("", response_model=OffersResponse)
async def get_offers(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=500, description="Items per page"),
    sort_field: str = Query("offer_id", description="Field to sort by"),
    sort_descending: bool = Query(False, description="Sort descending"),
    search: Optional[str] = Query(None, description="Search term for offer name"),
    media_type_id: int = Query(0, description="Filter by Media Type ID"),
    site_offer_status_id: int = Query(0, description="Filter by Status ID"),
    vertical_id: int = Query(0, description="Filter by Vertical ID")
):
    """
    Proxy endpoint to fetch offers from Cake Marketing API (XML) and return as JSON.
    """
    
    # Calculate start_at_row (Cake uses 1-based indexing for rows usually, or 0? user URL says start_at_row=0)
    # User URL: start_at_row=0 & row_limit=500. So it seems 1-based or 0-based. 
    # Usually: start_at_row = (page - 1) * limit + 1. 
    # But user example has start_at_row=0. Let's assume 1-based logic: page 1 -> start 1 (or 0?).
    # If user provided start_at_row=0, let's stick to 0-based for now? 
    # Wait, usually API pagination is start_row. 
    # Let's try (page - 1) * limit + 1 for standard 1-based start.
    # If page 1, limit 10: start 1.
    start_at_row = (page - 1) * limit + 1
    if page == 1 and start_at_row == 1:
        # Just to be safe with the user's "0" example, maybe they meant 0 index?
        # Standard Cake API typically uses 1 for the first row.
        # But let's follow the param structure. 
        # Actually user URL has start_at_row=0. Let's try 0-based if that works better, or stick to standard.
        # The user provided URL has start_at_row=0. I will use (page - 1) * limit + 1 because typically 'row 0' is header or it's 1-based.
        # Let's verify standard SQL/API behavior: row 1 is usually first.
        pass

    # However, to match the user's specific URL example `start_at_row=0`, I will use `(page - 1) * limit`.
    # If page=1, start=0. If page=2, limit=10, start=10.
    start_at_row = (page - 1) * limit

    # Construct Cake API URL
    # Using the exact base URL and API key from user request or settings
    # User provided key: 3YmDJeT3VHTFhDqAjr2OlQ
    # I should probably use settings.CAKE_API_KEY if available, but for this specific request I'll fallback to the one provided if not in settings or just use the one provided as it might be specific.
    # Actually, best practice is to use the settings one if it matches the domain.
    # The user gave a full URL: https://demo-new.cakemarketing.com/api/7/export.asmx/SiteOffers
    
    # I'll check if settings has CAKE_API_KEYUrl, if not hardcode for now based on request.
    # Assuming CAKE_API_KEY    # api_key = settings.CAKE_API_KEY if hasattr(settings, 'CAKE_API_KEY') and settings.CAKE_API_KEY else "3YmDJeT3VHTFhDqAjr2OlQ"
    cake_conn = await get_active_cake_connection()
    api_key = cake_conn["api_key"]
    base_url = cake_conn["api_offers_url"]
    
    params = {
        "api_key": api_key,
        "site_offer_id": 0,
        "site_offer_name": search if search else "",
        "brand_advertiser_id": 0,
        "vertical_id": vertical_id,
        "site_offer_type_id": 0,
        "media_type_id": media_type_id,
        "tag_id": 0,
        "start_at_row": start_at_row,
        "row_limit": limit,
        "sort_field": sort_field,
        "sort_descending": "TRUE" if sort_descending else "FALSE",
        "site_offer_status_id": site_offer_status_id
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(base_url, params=params, timeout=30.0)
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch offers from upstream API")
            
            # Parse XML
            try:
                data_dict = xmltodict.parse(response.content)
            except Exception as e:
                 raise HTTPException(status_code=500, detail=f"Failed to parse XML response: {str(e)}")

            response_root = data_dict.get('offer_export_response', {})
            if response_root.get('success') != 'true':
                 # Even if HTTP 200, API might report success: false
                 error_msg = response_root.get('message', 'Upstream API returned success=false')
                 raise HTTPException(status_code=400, detail=f"Upstream API Error: {error_msg}")
            
            row_count = int(response_root.get('row_count', 0))
            site_offers_data = response_root.get('site_offers', {})
            
            offers_list = []
            if site_offers_data:
                # xmltodict might return a list or a dict (if single item) or None
                raw_offers = site_offers_data.get('site_offer', [])
                if isinstance(raw_offers, dict):
                    raw_offers = [raw_offers]
                elif raw_offers is None:
                    raw_offers = []
                
                for offer in raw_offers:
                    # Flatten/Clean data for frontend table
                    
                    def get_text(item):
                        if isinstance(item, dict):
                            return item.get('#text', '')
                        return item

                    # Basic fields
                    flat_offer = {
                        "site_offer_id": get_text(offer.get('site_offer_id')),
                        "site_offer_name": get_text(offer.get('site_offer_name')),
                        "third_party_name": get_text(offer.get('third_party_name')),
                        "brand_advertiser_id": get_text(offer.get('brand_advertiser', {}).get('brand_advertiser_id', 0)) if offer.get('brand_advertiser') else 0,
                        "brand_advertiser_name": offer.get('brand_advertiser', {}).get('brand_advertiser_name', {}).get('#text', '') if offer.get('brand_advertiser') else '',
                        "vertical_name": offer.get('vertical', {}).get('vertical_name', {}).get('#text', '') if offer.get('vertical') else '',
                        "status": offer.get('site_offer_status', {}).get('site_offer_status_name', {}).get('#text', '') if offer.get('site_offer_status') else '',
                        "hidden": offer.get('hidden') == 'true',
                        "preview_link": get_text(offer.get('preview_link')),
                        "description": get_text(offer.get('site_offer_description')),
                        "restrictions": get_text(offer.get('restrictions')),
                        # Contract info logic - maybe take the default or first one for display
                        # Flattening payouts/price format from first contract if available
                        "payout": "N/A",
                        "price_format": "N/A"
                    }
                    
                    # Try to get default contract info
                    default_contract_id = offer.get('default_site_offer_contract_id')
                    contracts = offer.get('site_offer_contracts', {}).get('site_offer_contract_info', [])
                    if isinstance(contracts, dict):
                        contracts = [contracts]
                        
                    selected_contract = None
                    if contracts:
                        # Try to find default
                        for c in contracts:
                            if c.get('site_offer_contract_id') == default_contract_id:
                                selected_contract = c
                                break
                        # If no default match found (shouldnt allow, but fallback), use first
                        if not selected_contract and len(contracts) > 0:
                            selected_contract = contracts[0]
                            
                    if selected_contract:
                        flat_offer['price_format'] = selected_contract.get('price_format', {}).get('price_format_name', {}).get('#text', '')
                        # Current payout
                        payout_info = selected_contract.get('current_payout', {})
                        flat_offer['payout'] = payout_info.get('formatted_amount', '')

                    offers_list.append(flat_offer)

            total_pages = math.ceil(row_count / limit) if limit > 0 else 0

            return {
                "success": True,
                "row_count": row_count,
                "offers": offers_list,
                "page": page,
                "limit": limit,
                "total_pages": total_pages
            }

        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Connection error to upstream API: {str(e)}")

@router.get("/media-types")
async def get_media_types():
    """
    Fetch available media types from Cake Marketing API.
    """
    cake_conn = await get_active_cake_connection()
    api_key = cake_conn["api_key"]
    base_url = cake_conn["api_media_types_url"]
    params = {"api_key": api_key}

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(base_url, params=params, timeout=30.0)
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch media types from upstream API")
            
            try:
                data_dict = xmltodict.parse(response.content)
            except Exception as e:
                 raise HTTPException(status_code=500, detail=f"Failed to parse XML response: {str(e)}")

            # The API returns ArrayOfMediaType directly
            media_types_root = data_dict.get('ArrayOfMediaType', {})
            if not media_types_root:
                 # Fallback or check if it's mixed with namespaces
                 # xmltodict might strip namespaces or not depending on config, but usually basic parse keeps them in keys if no process_namespaces
                 # But sticking to simple get for now.
                 # If empty, return empty list
                 return []

            media_types_data = media_types_root.get('MediaType', [])
            
            if isinstance(media_types_data, dict):
                media_types_data = [media_types_data]
            elif media_types_data is None:
                media_types_data = []

            result = []
            for item in media_types_data:
                # API might return type_name or media_type_name depending on endpoint version/schema
                name = item.get('media_type_name') or item.get('type_name') or ''
                
                if isinstance(name, str) and name.strip():
                    result.append({
                        "media_type_id": int(item.get('media_type_id', 0)),
                        "media_type_name": name.strip()
                    })
            
            return result

        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Connection error to upstream API: {str(e)}")
@router.get("/verticals")
async def get_verticals():
    """
    Fetch available verticals from Cake Marketing API.
    """
    cake_conn = await get_active_cake_connection()
    api_key = cake_conn["api_key"]
    base_url = cake_conn["api_verticals_url"]
    params = {
        "api_key": api_key,
        "vertical_category_id": 0
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(base_url, params=params, timeout=30.0)
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=f"Failed to fetch verticals from upstream API: {response.status_code}")
            
            try:
                data_dict = xmltodict.parse(response.content)
            except Exception as e:
                 raise HTTPException(status_code=500, detail=f"Failed to parse XML response: {str(e)}")

            # The API returns ArrayOfVertical directly, vertical_export_response, or vertical_response (v2)
            # Checking for common patterns
            root = data_dict.get('vertical_response') or data_dict.get('vertical_export_response') or data_dict.get('ArrayOfVertical') or {}
            if not root:
                return []

            # Check for different possible key names (Cake API is inconsistent with case)
            verticals_data = []
            if 'verticals' in root:
                v_container = root['verticals']
                verticals_data = v_container.get('vertical') or v_container.get('Vertical') or []
            else:
                verticals_data = root.get('vertical') or root.get('Vertical') or []
            
            if isinstance(verticals_data, dict):
                verticals_data = [verticals_data]
            elif verticals_data is None:
                verticals_data = []

            result = []
            for item in verticals_data:
                # Support both lowercase and TitleCase for fields
                name = item.get('vertical_name') or item.get('VerticalName') or item.get('Vertical_Name') or ''
                vid = item.get('vertical_id') or item.get('VerticalID') or item.get('Vertical_ID') or 0
                
                if isinstance(name, str) and name.strip():
                    result.append({
                        "vertical_id": int(vid),
                        "vertical_name": name.strip()
                    })
            
            return result

        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Connection error to upstream API: {str(e)}")

@router.get("/statuses")
async def get_statuses():
    """
    Return standard Cake site offer statuses.
    """
    # These are usually fixed in Cake
    return [
        # {"status_id": 0, "status_name": "All Statuses"},
        {"status_id": 1, "status_name": "Public"},
        {"status_id": 2, "status_name": "Private"},
        {"status_id": 3, "status_name": "Apply To Run"},
        {"status_id": 4, "status_name": "Inactive"}
    ]
