import React, { useState, useEffect } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import "./AffiliateSignup.css";
import { termsText } from "./TermsText";


export default function AffiliateSignup() {
    const [form, setForm] = useState({
        companyInfo: {
            companyName: "",
            address: "",
            address2: "",
            city: "",
            state: "",
            zip: "",
            country: "",
            corporateWebsite: "",
            referral: ""
        },
        marketingInfo: {


            paymentModel: "1",
            primaryCategory: "1",
            secondaryCategory: "1",
            comments: ""
        },
        accountInfo: {
            firstName: "",
            lastName: "",
            title: "",
            workPhone: "",
            cellPhone: "",
            fax: "",
            email: "",
            timezone: "Pacific Standard Time (Mexico)",
            imService: "Google",
            imHandle: "",

        },
        paymentInfo: {
            payTo: "0",
            currency: "1",
            taxClass: "Corporation",
            ssnTaxId: ""
        },
        agreed: false
    });
    const [captchaValue, setCaptchaValue] = useState(null);
    const [errors, setErrors] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [ipAddress, setIpAddress] = useState("0.0.0.0");

    useEffect(() => {
        // Fetch user IP address
        fetch('https://api.ipify.org?format=json')
            .then(response => response.json())
            .then(data => {
                
                setIpAddress(data.ip);
            })
            .catch(error => {
                console.error("Error fetching IP:", error);
                // Fallback is already set in initial state
            });
    }, []);

    const handleChange = (section, field, value) => {
        setForm(prev => ({
            ...prev,
            [section]: { ...prev[section], [field]: value }
        }));
        // Clear error for this field if it exists
        if (errors[`${section}.${field}`]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[`${section}.${field}`];
                return newErrors;
            });
        }
    };

    const handleSingleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleCaptchaChange = (value) => {
        
        setCaptchaValue(value);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setErrors({}); // Clear previous errors

        const newErrors = {};

        // Company Info Validation
        if (!form.companyInfo.companyName.trim()) newErrors['companyInfo.companyName'] = "Company Name is required";
        if (!form.companyInfo.address.trim()) newErrors['companyInfo.address'] = "Address is required";
        if (!form.companyInfo.address2.trim()) newErrors['companyInfo.address2'] = "Address Line 2 is required";
        if (!form.companyInfo.city.trim()) newErrors['companyInfo.city'] = "City is required";
        if (!form.companyInfo.state.trim()) newErrors['companyInfo.state'] = "State is required";
        if (!form.companyInfo.zip.trim()) newErrors['companyInfo.zip'] = "Zip/Postcode is required";
        if (!form.companyInfo.country) newErrors['companyInfo.country'] = "Country is required";
        if (!form.companyInfo.referral) newErrors['companyInfo.referral'] = "Please select a referral source";

        // Account Info Validation
        if (!form.accountInfo.firstName.trim()) newErrors['accountInfo.firstName'] = "First Name is required";
        if (!form.accountInfo.lastName.trim()) newErrors['accountInfo.lastName'] = "Last Name is required";
        if (!form.accountInfo.workPhone.trim()) newErrors['accountInfo.workPhone'] = "Work Phone is required";
        if (!form.accountInfo.email.trim()) newErrors['accountInfo.email'] = "Email is required";
        else if (!/\S+@\S+\.\S+/.test(form.accountInfo.email)) newErrors['accountInfo.email'] = "Invalid email format";

        // Payment Info Validation
        if (!form.paymentInfo.payTo) newErrors['paymentInfo.payTo'] = "Payment To is required";
        if (!form.paymentInfo.currency) newErrors['paymentInfo.currency'] = "Currency is required";
        if (!form.paymentInfo.taxClass) newErrors['paymentInfo.taxClass'] = "Tax Class is required";
        if (!form.paymentInfo.ssnTaxId.trim()) newErrors['paymentInfo.ssnTaxId'] = "SSN or Tax ID is required";

        // Other Validation
        if (!form.agreed) newErrors['agreed'] = "You must agree to the Terms and Conditions";
        if (!captchaValue) newErrors['captcha'] = "Please verify you are not a robot";

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            // Find the first error field and scroll to it
            // Simple scroll to top for now as mapping fields to refs is complex
            window.scrollTo(0, 0);
            return;
        }

        

        // precise construction of strict parameters
        const third_party_name = form.companyInfo.companyName.toLowerCase().replace(/\s+/g, '_').substring(0, 50); // basic slugify

        const today = new Date();
        const date_added = `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}/${today.getFullYear()}`;

        const apiParams = {
            api_key: import.meta.env.VITE_CAKE_MARKETING_API_KEY,
            affiliate_id: "0",
            affiliate_name: form.accountInfo.firstName + " " + form.accountInfo.lastName,
            third_party_name: "",
            account_status_id: "1",
            inactive_reason_id: "0",
            affiliate_tier_id: "1",
            account_manager_id: "0",
            hide_offers: "FALSE",
            website: form.companyInfo.corporateWebsite,
            tax_class: form.paymentInfo.taxClass,
            ssn_tax_id: form.paymentInfo.ssnTaxId,
            vat_tax_required: "FALSE",
            swift_iban: "", // Clear hardcoded value
            payment_to: form.paymentInfo.payTo, // Basic mapping assumption
            payment_fee: "0",
            payment_min_threshold: "100",
            currency_id: form.paymentInfo.currency,
            payment_setting_id: "0",
            billing_cycle_id: "0",
            payment_type_id: "0",
            payment_type_info: "payment type info",
            address_street: form.companyInfo.address,
            address_street2: form.companyInfo.address2 || "",
            address_city: form.companyInfo.city,
            address_state: form.companyInfo.state,
            address_zip_code: form.companyInfo.zip,
            address_country: form.companyInfo.country,
            media_type_ids: "1",
            price_format_ids: form.marketingInfo.paymentModel,
            vertical_category_ids: form.marketingInfo.primaryCategory + (form.marketingInfo.secondaryCategory ? "," + form.marketingInfo.secondaryCategory : ""),
            country_codes: form.companyInfo.country, // strict requirement
            tags: "",
            pixel_html: "",
            postback_url: "",
            postback_delay_ms: "1",
            fire_global_pixel: "TRUE",
            online_signup: "TRUE",
            signup_ip_address: ipAddress,
            referral_affiliate_id: "0",
            referral_notes: form.companyInfo.referral,
            date_added: date_added,
            terms_and_conditions_agreed: "TRUE",
            notes: form.marketingInfo.comments
        };

        const queryParams = new URLSearchParams(apiParams).toString();
        // Construct the full URL as requested
        const targetUrl = `https://login.vellko.com/api/2/addedit.asmx/Affiliate?${queryParams}`;

        

        fetch(targetUrl, {
            method: 'GET', // or POST if the API supports it, but query params usually imply GET for this type of legacy endpoint or POST with no body. Sticking to GET as per encoded URL structure.
            headers: {
                'Accept': 'application/xml', // .asmx usually returns XML
            }
        })
            .then(response => {
                // The API might return XML, let's just log it and assume success if 200 OK for now, 
                // or try to parse if needed. For a signup form, usually checking ok status is a good start.
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text(); // .asmx often returns XML text
            })
            .then(data => {
                
                // Basic check for success in XML if possible, but for now assuming if request worked we show success
                // Example success response: <success>true</success> or similar. 
                // We'll assume success for the demo flow.
                setSubmitted(true);
                window.scrollTo(0, 0);
            })
            .catch(error => {
                
                // For demo purposes/CORS issues with external APIs in local dev, we might see errors.
                // However, user asked to use this specific URL. 
                alert("Error submitting form. Please check console for details. (Note: CORS might block this request from localhost)");
            });
    };

    const handlePrintTerms = () => {
        const printWindow = window.open('', '', 'width=800,height=600');
        printWindow.document.write('<html><head><title>Terms and Conditions</title>');
        printWindow.document.write('<style>body{font-family: Arial, sans-serif; padding: 20px; white-space: pre-wrap;}</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write('<h2>Terms and Conditions</h2>');
        printWindow.document.write(termsText);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    };


    return (
        <>
            <div className="header-bar"></div>
            <div className="container-fluid signup-page-container min-vh-100 py-4 d-flex justify-content-center">
                <div className="card shadow-sm border-0" style={{ maxWidth: "850px", width: "100%" }}>
                    <div className="card-body p-4">
                        {submitted ? (
                            <div className="text-center py-5">
                                <div className="mb-4 text-success">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="currentColor" className="bi bi-check-circle-fill" viewBox="0 0 16 16">
                                        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z" />
                                    </svg>
                                </div>
                                <h2 className="fw-bold mb-3">Application Submitted!</h2>
                                <p className="lead text-muted mb-4">
                                    Thank you for signing up for the Vellko Media Affiliate Program. <br />
                                    We have received your application and will review it shortly.
                                </p>
                                <button className="btn btn-primary px-4" onClick={() => window.location.reload()}>
                                    Return to Home
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="text-center mb-4">

                                    <img src="https://eu1-us1.ckcdnassets.com/2362/logos/signuplogo.png" alt="VELLKO" className="img-fluid mb-2" style={{ maxHeight: "150px" }} />
                                    <h4 className="text-muted text-uppercase mb-2 d-block" style={{ fontSize: '1.8rem', letterSpacing: '1px' }}>Vellko Media Affiliate Signup</h4>
                                    {/* Fallback for logo if image missing */}
                                    <h1 className="fw-bold text-danger d-none">VELKO</h1>
                                </div>

                                {Object.keys(errors).length > 0 && (
                                    <div className="alert alert-danger text-center" role="alert">
                                        Please correct the errors below.
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} noValidate className="p-3">
                                    {/* Company Information */}
                                    <h5 className="section-title border-bottom pb-2 mb-3">Company Information</h5>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Company Name <span className="text-danger">*</span></label>
                                        <input type="text" className={`form-control ${errors['companyInfo.companyName'] ? 'is-invalid' : ''}`} required placeholder="Enter Company Name"
                                            value={form.companyInfo.companyName} onChange={e => handleChange('companyInfo', 'companyName', e.target.value)} />
                                        <div className="invalid-feedback">{errors['companyInfo.companyName']}</div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Address Line 1 <span className="text-danger">*</span></label>
                                        <input type="text" className={`form-control ${errors['companyInfo.address'] ? 'is-invalid' : ''}`} required placeholder="Enter Street Address"
                                            value={form.companyInfo.address} onChange={e => handleChange('companyInfo', 'address', e.target.value)} />
                                        <div className="invalid-feedback">{errors['companyInfo.address']}</div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Address Line 2 <span className="text-danger">*</span></label>
                                        <input type="text" className={`form-control ${errors['companyInfo.address2'] ? 'is-invalid' : ''}`} required placeholder="Enter Apartment, Suite, etc."
                                            value={form.companyInfo.address2} onChange={e => handleChange('companyInfo', 'address2', e.target.value)} />
                                        <div className="invalid-feedback">{errors['companyInfo.address2']}</div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">City <span className="text-danger">*</span></label>
                                        <input type="text" className={`form-control ${errors['companyInfo.city'] ? 'is-invalid' : ''}`} required placeholder="Enter City"
                                            value={form.companyInfo.city} onChange={e => handleChange('companyInfo', 'city', e.target.value)} />
                                        <div className="invalid-feedback">{errors['companyInfo.city']}</div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small text-muted">State <span className="text-danger">*</span></label>
                                        <input type="text" className={`form-control ${errors['companyInfo.state'] ? 'is-invalid' : ''}`} required placeholder="Enter State" value={form.companyInfo.state} onChange={e => handleChange('companyInfo', 'state', e.target.value)} />
                                        <div className="invalid-feedback">{errors['companyInfo.state']}</div>
                                    </div>

                                    <div className="row g-2 mb-3">
                                        <div className="col-md-6">
                                            <label className="form-label small text-muted">Zip / Postcode <span className="text-danger">*</span></label>
                                            <input type="text" className={`form-control ${errors['companyInfo.zip'] ? 'is-invalid' : ''}`} required placeholder="Enter Zip Code"
                                                value={form.companyInfo.zip} onChange={e => handleChange('companyInfo', 'zip', e.target.value)} />
                                            <div className="invalid-feedback">{errors['companyInfo.zip']}</div>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small text-muted">Country <span className="text-danger">*</span></label>
                                            <select className={`form-select ${errors['companyInfo.country'] ? 'is-invalid' : ''}`} required value={form.companyInfo.country} onChange={e => handleChange('companyInfo', 'country', e.target.value)}>
                                                <option value="AF">Afghanistan</option>
                                                <option value="AX">Aland Islands</option>
                                                <option value="AL">Albania</option>
                                                <option value="DZ">Algeria</option>
                                                <option value="AS">American Samoa</option>
                                                <option value="AD">Andorra</option>
                                                <option value="AO">Angola</option>
                                                <option value="AI">Anguilla</option>
                                                <option value="AQ">Antarctica</option>
                                                <option value="AG">Antigua and Barbuda</option>
                                                <option value="AR">Argentina</option>
                                                <option value="AM">Armenia</option>
                                                <option value="AW">Aruba</option>
                                                <option value="AP">Asia/Pacific Region</option>
                                                <option value="AU">Australia</option>
                                                <option value="AT">Austria</option>
                                                <option value="AZ">Azerbaijan</option>
                                                <option value="BS">Bahamas</option>
                                                <option value="BH">Bahrain</option>
                                                <option value="BD">Bangladesh</option>
                                                <option value="BB">Barbados</option>
                                                <option value="BY">Belarus</option>
                                                <option value="BE">Belgium</option>
                                                <option value="BZ">Belize</option>
                                                <option value="BJ">Benin</option>
                                                <option value="BM">Bermuda</option>
                                                <option value="BT">Bhutan</option>
                                                <option value="BO">Bolivia</option>
                                                <option value="BQ">bonaire/sint eustatius/saba</option>
                                                <option value="BA">Bosnia and Herzegovina</option>
                                                <option value="BW">Botswana</option>
                                                <option value="BV">Bouvet Island</option>
                                                <option value="BR">Brazil</option>
                                                <option value="IO">British Indian Ocean Territory</option>
                                                <option value="BN">Brunei Darussalam</option>
                                                <option value="BG">Bulgaria</option>
                                                <option value="BF">Burkina Faso</option>
                                                <option value="BI">Burundi</option>
                                                <option value="KH">Cambodia</option>
                                                <option value="CM">Cameroon</option>
                                                <option value="CA">Canada</option>
                                                <option value="CV">Cape Verde</option>
                                                <option value="KY">Cayman Islands</option>
                                                <option value="CF">Central African Republic</option>
                                                <option value="TD">Chad</option>
                                                <option value="CL">Chile</option>
                                                <option value="CN">China</option>
                                                <option value="CX">christmas island</option>
                                                <option value="CC">cocos (keeling) islands</option>
                                                <option value="CO">Colombia</option>
                                                <option value="KM">Comoros</option>
                                                <option value="CG">Congo</option>
                                                <option value="CD">Congo, The Democratic Republic of the</option>
                                                <option value="CK">Cook Islands</option>
                                                <option value="CR">Costa Rica</option>
                                                <option value="CI">Cote D'Ivoire</option>
                                                <option value="HR">Croatia</option>
                                                <option value="CW">curacao</option>
                                                <option value="CY">Cyprus</option>
                                                <option value="CZ">Czech Republic</option>
                                                <option value="DK">Denmark</option>
                                                <option value="DJ">Djibouti</option>
                                                <option value="DM">Dominica</option>
                                                <option value="DO">Dominican Republic</option>
                                                <option value="EC">Ecuador</option>
                                                <option value="EG">Egypt</option>
                                                <option value="SV">El Salvador</option>
                                                <option value="GQ">Equatorial Guinea</option>
                                                <option value="ER">Eritrea</option>
                                                <option value="EE">Estonia</option>
                                                <option value="ET">Ethiopia</option>
                                                <option value="EU">Europe</option>
                                                <option value="FK">Falkland Islands (Malvinas)</option>
                                                <option value="FO">Faroe Islands</option>
                                                <option value="FJ">Fiji</option>
                                                <option value="FI">Finland</option>
                                                <option value="FR">France</option>
                                                <option value="GF">French Guiana</option>
                                                <option value="PF">French Polynesia</option>
                                                <option value="TF">french southern territories</option>
                                                <option value="GA">Gabon</option>
                                                <option value="GM">Gambia</option>
                                                <option value="GE">Georgia</option>
                                                <option value="DE">Germany</option>
                                                <option value="GH">Ghana</option>
                                                <option value="GI">Gibraltar</option>
                                                <option value="GR">Greece</option>
                                                <option value="GL">Greenland</option>
                                                <option value="GD">Grenada</option>
                                                <option value="GP">Guadeloupe</option>
                                                <option value="GU">Guam</option>
                                                <option value="GT">Guatemala</option>
                                                <option value="GG">Guernsey</option>
                                                <option value="GN">Guinea</option>
                                                <option value="GW">Guinea-Bissau</option>
                                                <option value="GY">Guyana</option>
                                                <option value="HT">Haiti</option>
                                                <option value="HM">heard and mc donald islands</option>
                                                <option value="VA">Holy See (Vatican City State)</option>
                                                <option value="HN">Honduras</option>
                                                <option value="HK">Hong Kong</option>
                                                <option value="HU">Hungary</option>
                                                <option value="IS">Iceland</option>
                                                <option value="IN">India</option>
                                                <option value="ID">Indonesia</option>
                                                <option value="IQ">Iraq</option>
                                                <option value="IE">Ireland</option>
                                                <option value="IM">Isle of Man</option>
                                                <option value="IL">Israel</option>
                                                <option value="IT">Italy</option>
                                                <option value="JM">Jamaica</option>
                                                <option value="JP">Japan</option>
                                                <option value="JE">Jersey</option>
                                                <option value="JO">Jordan</option>
                                                <option value="KZ">Kazakstan</option>
                                                <option value="KE">Kenya</option>
                                                <option value="KI">Kiribati</option>
                                                <option value="KR">Korea, Republic of</option>
                                                <option value="KW">Kuwait</option>
                                                <option value="KG">Kyrgyzstan</option>
                                                <option value="LA">Lao People's Democratic Republic</option>
                                                <option value="LV">Latvia</option>
                                                <option value="LB">Lebanon</option>
                                                <option value="LS">Lesotho</option>
                                                <option value="LR">Liberia</option>
                                                <option value="LY">Libyan Arab Jamahiriya</option>
                                                <option value="LI">Liechtenstein</option>
                                                <option value="LT">Lithuania</option>
                                                <option value="LU">Luxembourg</option>
                                                <option value="MO">Macau</option>
                                                <option value="MK">Macedonia</option>
                                                <option value="MG">Madagascar</option>
                                                <option value="MW">Malawi</option>
                                                <option value="MY">Malaysia</option>
                                                <option value="MV">Maldives</option>
                                                <option value="ML">Mali</option>
                                                <option value="MT">Malta</option>
                                                <option value="MH">Marshall Islands</option>
                                                <option value="MQ">Martinique</option>
                                                <option value="MR">Mauritania</option>
                                                <option value="MU">Mauritius</option>
                                                <option value="YT">Mayotte</option>
                                                <option value="MX">Mexico</option>
                                                <option value="FM">Micronesia, Federated States of</option>
                                                <option value="MD">Moldova, Republic of</option>
                                                <option value="MC">Monaco</option>
                                                <option value="MN">Mongolia</option>
                                                <option value="ME">Montenegro</option>
                                                <option value="MS">Montserrat</option>
                                                <option value="MA">Morocco</option>
                                                <option value="MZ">Mozambique</option>
                                                <option value="MM">Myanmar</option>
                                                <option value="NA">Namibia</option>
                                                <option value="NR">Nauru</option>
                                                <option value="NP">Nepal</option>
                                                <option value="NL">Netherlands</option>
                                                <option value="AN">Netherlands Antilles</option>
                                                <option value="NC">New Caledonia</option>
                                                <option value="NZ">New Zealand</option>
                                                <option value="NI">Nicaragua</option>
                                                <option value="NE">Niger</option>
                                                <option value="NG">Nigeria</option>
                                                <option value="NU">Niue</option>
                                                <option value="NF">Norfolk Island</option>
                                                <option value="MP">Northern Mariana Islands</option>
                                                <option value="NO">Norway</option>
                                                <option value="OM">Oman</option>
                                                <option value="PK">Pakistan</option>
                                                <option value="PW">Palau</option>
                                                <option value="PS">Palestinian Territory, Occupied</option>
                                                <option value="PA">Panama</option>
                                                <option value="PG">Papua New Guinea</option>
                                                <option value="PY">Paraguay</option>
                                                <option value="PE">Peru</option>
                                                <option value="PH">Philippines</option>
                                                <option value="PN">pitcairn</option>
                                                <option value="PL">Poland</option>
                                                <option value="PT">Portugal</option>
                                                <option value="PR">Puerto Rico</option>
                                                <option value="QA">Qatar</option>
                                                <option value="RE">Reunion</option>
                                                <option value="RO">Romania</option>
                                                <option value="RU">Russian Federation</option>
                                                <option value="RW">Rwanda</option>
                                                <option value="BL">saint barthelemy</option>
                                                <option value="KN">Saint Kitts and Nevis</option>
                                                <option value="LC">Saint Lucia</option>
                                                <option value="MF">saint martin</option>
                                                <option value="PM">Saint Pierre and Miquelon</option>
                                                <option value="VC">Saint Vincent and the Grenadines</option>
                                                <option value="WS">Samoa</option>
                                                <option value="SM">San Marino</option>
                                                <option value="ST">Sao Tome and Principe</option>
                                                <option value="SA">Saudi Arabia</option>
                                                <option value="SN">Senegal</option>
                                                <option value="RS">Serbia</option>
                                                <option value="SC">Seychelles</option>
                                                <option value="SL">Sierra Leone</option>
                                                <option value="SG">Singapore</option>
                                                <option value="SX">sint maarten</option>
                                                <option value="SK">Slovakia</option>
                                                <option value="SI">Slovenia</option>
                                                <option value="SB">Solomon Islands</option>
                                                <option value="SO">Somalia</option>
                                                <option value="ZA">South Africa</option>
                                                <option value="GS">south georgia / south sandwich isl</option>
                                                <option value="SS">south sudan</option>
                                                <option value="ES">Spain</option>
                                                <option value="LK">Sri Lanka</option>
                                                <option value="SH">st. helena</option>
                                                <option value="SR">Suriname</option>
                                                <option value="SJ">svalbard and jan mayen islands</option>
                                                <option value="SZ">Swaziland</option>
                                                <option value="SE">Sweden</option>
                                                <option value="CH">Switzerland</option>
                                                <option value="TW">Taiwan</option>
                                                <option value="TJ">Tajikistan</option>
                                                <option value="TZ">Tanzania, United Republic of</option>
                                                <option value="TH">Thailand</option>
                                                <option value="TL">timor-leste</option>
                                                <option value="TG">Togo</option>
                                                <option value="TK">Tokelau</option>
                                                <option value="TO">Tonga</option>
                                                <option value="TT">Trinidad and Tobago</option>
                                                <option value="TN">Tunisia</option>
                                                <option value="TR">Turkey</option>
                                                <option value="TM">Turkmenistan</option>
                                                <option value="TC">Turks and Caicos Islands</option>
                                                <option value="TV">Tuvalu</option>
                                                <option value="UG">Uganda</option>
                                                <option value="UA">Ukraine</option>
                                                <option value="AE">United Arab Emirates</option>
                                                <option value="GB">United Kingdom</option>
                                                <option value="US">United States</option>
                                                <option value="UM">United States Minor Outlying Islands</option>
                                                <option value="UY">Uruguay</option>
                                                <option value="UZ">Uzbekistan</option>
                                                <option value="VU">Vanuatu</option>
                                                <option value="VE">Venezuela</option>
                                                <option value="VN">Vietnam</option>
                                                <option value="VG">Virgin Islands, British</option>
                                                <option value="VI">Virgin Islands, U.S.</option>
                                                <option value="WF">Wallis and Futuna</option>
                                                <option value="EH">western sahara</option>
                                                <option value="YE">Yemen</option>
                                                <option value="ZM">Zambia</option>
                                                <option value="ZW">Zimbabwe</option>
                                            </select>
                                            <div className="invalid-feedback">{errors['companyInfo.country']}</div>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Corporate Website</label>
                                        <input type="text" className="form-control" placeholder="Enter Corporate Website"
                                            value={form.companyInfo.corporateWebsite} onChange={e => handleChange('companyInfo', 'corporateWebsite', e.target.value)} />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Who Referred You? <span className="text-danger">*</span></label>
                                        <select className={`form-select ${errors['companyInfo.referral'] ? 'is-invalid' : ''}`} required value={form.companyInfo.referral} onChange={e => handleChange('companyInfo', 'referral', e.target.value)}>
                                            <option value="">Select Referral</option>
                                            <option value="Neha Deshmukh">Neha Deshmukh</option>
                                            <option value="G Raghu">G raghu</option>
                                            <option value="Shobha Rawat">Shobha rawat</option>
                                            <option value="Simran Aswani">Shobha rawat</option>
                                        </select>
                                        <div className="invalid-feedback">{errors['companyInfo.referral']}</div>
                                    </div>

                                    <br />
                                    {/* Marketing Information */}
                                    <h5 className="section-title border-bottom pb-2 mb-3 mt-4">Marketing Information</h5>


                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Payment Model</label>
                                        <select className="form-select" value={form.marketingInfo.paymentModel} onChange={e => handleChange('marketingInfo', 'paymentModel', e.target.value)}>
                                            <option value="1">CPA</option>
                                            <option value="2">CPC</option>
                                            <option value="3">CPM</option>
                                            <option value="4">Fixed</option>
                                            <option value="5">RevShare</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Primary Category</label>
                                        <select className="form-select" value={form.marketingInfo.primaryCategory} onChange={e => handleChange('marketingInfo', 'primaryCategory', e.target.value)}>
                                            <option value="1">Animals</option>
                                            <option value="2">Animals --&gt; Pets</option>
                                            <option value="3">Animals --&gt; Wildlife</option>
                                            <option value="4">Arts &amp; Entertainment</option>
                                            <option value="5">Arts &amp; Entertainment --&gt; Amusement Parks</option>
                                            <option value="6">Arts &amp; Entertainment --&gt; Clubs &amp; Nightlife</option>
                                            <option value="7">Arts &amp; Entertainment --&gt; Comedy</option>
                                            <option value="8">Arts &amp; Entertainment --&gt; Film &amp; Television</option>
                                            <option value="9">Arts &amp; Entertainment --&gt; Games</option>
                                            <option value="10">Arts &amp; Entertainment --&gt; Music</option>
                                            <option value="11">Arts &amp; Entertainment --&gt; Pop Culture</option>
                                            <option value="12">Arts &amp; Entertainment --&gt; Reading</option>
                                            <option value="13">Arts &amp; Entertainment --&gt; Theater &amp; Performing Arts</option>
                                            <option value="14">Arts &amp; Entertainment --&gt; Visual Arts</option>
                                            <option value="15">Autos</option>
                                            <option value="16">Business &amp; Finance</option>
                                            <option value="17">Business &amp; Finance --&gt; Advertising &amp; Marketing</option>
                                            <option value="18">Business &amp; Finance --&gt; Billing</option>
                                            <option value="19">Business &amp; Finance --&gt; Careers</option>
                                            <option value="20">Business &amp; Finance --&gt; Finance &amp; Investing</option>
                                            <option value="21">Business &amp; Finance --&gt; Home Office</option>
                                            <option value="22">Business &amp; Finance --&gt; Insurance</option>
                                            <option value="23">Business &amp; Finance --&gt; Management &amp; Corporate Operations</option>
                                            <option value="24">Business &amp; Finance --&gt; Marketing &amp; PR</option>
                                            <option value="25">Business &amp; Finance --&gt; Small Business</option>
                                            <option value="26">Education</option>
                                            <option value="27">Education --&gt; Career Advice</option>
                                            <option value="28">Education --&gt; College</option>
                                            <option value="29">Education --&gt; Financial Aid</option>
                                            <option value="30">Education --&gt; Foreign Language</option>
                                            <option value="31">Education --&gt; Home Schooling</option>
                                            <option value="32">Education --&gt; Home Study Courses</option>
                                            <option value="33">Education --&gt; Study Skills</option>
                                            <option value="34">Education --&gt; Teaching Resources</option>
                                            <option value="35">Electronics &amp; Computers</option>
                                            <option value="36">Electronics &amp; Computers --&gt; Brands</option>
                                            <option value="37">Electronics &amp; Computers --&gt; Cameras</option>
                                            <option value="38">Cell Phones / Mobiles</option>
                                            <option value="39">Electronics &amp; Computers --&gt; Components</option>
                                            <option value="40">Electronics &amp; Computers --&gt; Computers</option>
                                            <option value="41">Electronics &amp; Computers --&gt; Handhelds &amp; PDAs</option>
                                            <option value="42">Electronics &amp; Computers --&gt; Internet Service Providers</option>
                                            <option value="43">Electronics &amp; Computers --&gt; Music Players</option>
                                            <option value="44">Electronics &amp; Computers --&gt; Networking &amp; Wireless</option>
                                            <option value="45">Electronics &amp; Computers --&gt; Personal Electronics</option>
                                            <option value="46">Electronics &amp; Computers --&gt; Programming</option>
                                            <option value="47">Electronics &amp; Computers --&gt; Software</option>
                                            <option value="48">Electronics &amp; Computers --&gt; Televisions</option>
                                            <option value="49">Financial Products &amp; Services</option>
                                            <option value="50">Financial Products &amp; Services --&gt; Banking</option>
                                            <option value="51">Financial Products &amp; Services --&gt; Credit Products</option>
                                            <option value="52">Financial Products &amp; Services --&gt; Financial Services</option>
                                            <option value="53">Financial Products &amp; Services --&gt; Insurance</option>
                                            <option value="54">Financial Products &amp; Services --&gt; Loans</option>
                                            <option value="55">Financial Products &amp; Services --&gt; Payroll &amp; Payment</option>
                                            <option value="56">Financial Products &amp; Services --&gt; Retirement &amp; Investing</option>
                                            <option value="57">Food &amp; Drink</option>
                                            <option value="58">Food &amp; Drink --&gt; Baking</option>
                                            <option value="59">Food &amp; Drink --&gt; Coffee</option>
                                            <option value="60">Food &amp; Drink --&gt; Cooking</option>
                                            <option value="61">Food &amp; Drink --&gt; Cuisine Types</option>
                                            <option value="62">Food &amp; Drink --&gt; Health Food</option>
                                            <option value="63">Food &amp; Drink --&gt; Natural Foods</option>
                                            <option value="64">Food &amp; Drink --&gt; Restaurants</option>
                                            <option value="65">Food &amp; Drink --&gt; Snacks</option>
                                            <option value="66">Health, Beauty &amp; Personal Care</option>
                                            <option value="67">Health, Beauty &amp; Personal Care --&gt; Body Art</option>
                                            <option value="68">Health, Beauty &amp; Personal Care --&gt; Face &amp; Body Care</option>
                                            <option value="69">Health, Beauty &amp; Personal Care --&gt; Fitness</option>
                                            <option value="70">Health, Beauty &amp; Personal Care --&gt; Hair Care</option>
                                            <option value="71">Health, Beauty &amp; Personal Care --&gt; Health</option>
                                            <option value="72">Health, Beauty &amp; Personal Care --&gt; Nutrition</option>
                                            <option value="73">Hobbies</option>
                                            <option value="74">Hobbies --&gt; Auto Work</option>
                                            <option value="75">Hobbies --&gt; Collecting</option>
                                            <option value="76">Hobbies --&gt; Handicrafts</option>
                                            <option value="77">Hobbies --&gt; Music</option>
                                            <option value="78">Hobbies --&gt; Photography</option>
                                            <option value="79">Hobbies --&gt; Writing</option>
                                            <option value="80">Home &amp; Garden</option>
                                            <option value="81">Home &amp; Garden --&gt; Gardening</option>
                                            <option value="82">Home &amp; Garden --&gt; Home Furnishings &amp; Decorating</option>
                                            <option value="83">Home &amp; Garden --&gt; Home Improvement</option>
                                            <option value="84">Home &amp; Garden --&gt; Housewares</option>
                                            <option value="85">Internet &amp; Online Activities</option>
                                            <option value="86">Internet &amp; Online Activities --&gt; Apps</option>
                                            <option value="87">Internet &amp; Online Activities --&gt; Blogs</option>
                                            <option value="88">Internet &amp; Online Activities --&gt; File Sharing &amp; Hosting</option>
                                            <option value="89">Internet &amp; Online Activities --&gt; Games &amp; Quizzes</option>
                                            <option value="90">Internet &amp; Online Activities --&gt; Navigation</option>
                                            <option value="91">Internet &amp; Online Activities --&gt; News</option>
                                            <option value="92">Internet &amp; Online Activities --&gt; Online Dating</option>
                                            <option value="93">Internet &amp; Online Activities --&gt; Photo Sharing</option>
                                            <option value="94">Internet &amp; Online Activities --&gt; Research</option>
                                            <option value="95">Internet &amp; Online Activities --&gt; Shopping</option>
                                            <option value="96">Internet &amp; Online Activities --&gt; Site Building</option>
                                            <option value="97">Internet &amp; Online Activities --&gt; Social Networking</option>
                                            <option value="98">Internet &amp; Online Activities --&gt; Streaming</option>
                                            <option value="99">Internet &amp; Online Activities --&gt; Video Sharing</option>
                                            <option value="100">Lifestyles</option>
                                            <option value="101">Lifestyles --&gt; Clubs &amp; Organizations</option>
                                            <option value="102">Lifestyles --&gt; Country Club Members</option>
                                            <option value="103">Lifestyles --&gt; Do It Yourselfers (DIY)</option>
                                            <option value="104">Lifestyles --&gt; Gift Giving</option>
                                            <option value="105">Lifestyles --&gt; Green Living</option>
                                            <option value="106">Lifestyles --&gt; Healthy Living</option>
                                            <option value="107">Lifestyles --&gt; Holidays &amp; Seasonal Events</option>
                                            <option value="108">Lifestyles --&gt; Home Entertaining</option>
                                            <option value="109">Lifestyles --&gt; Luxury Pursuits</option>
                                            <option value="110">Lifestyles --&gt; Military</option>
                                            <option value="111">Lifestyles --&gt; Opinion Leaders</option>
                                            <option value="112">Lifestyles --&gt; Parenting &amp; Family</option>
                                            <option value="113">Lifestyles --&gt; Rural Farming</option>
                                            <option value="114">Lifestyles --&gt; Self-Improvement</option>
                                            <option value="115">Lifestyles --&gt; Wedding Planning</option>
                                            <option value="116">Other Vehicles</option>
                                            <option value="117">Other Vehicles? --&gt; Aircraft</option>
                                            <option value="118">Other Vehicles? --&gt; Boats</option>
                                            <option value="119">Other Vehicles? --&gt; Golf Carts</option>
                                            <option value="120">Other Vehicles? --&gt; Heavy Equipment</option>
                                            <option value="121">Other Vehicles? --&gt; Military Vehicles</option>
                                            <option value="122">Other Vehicles? --&gt; Motorcycles &amp; ATVs</option>
                                            <option value="123">Other Vehicles? --&gt; RVs, Campers &amp; Trailers</option>
                                            <option value="124">Other Vehicles? --&gt; Snowmobiles</option>
                                            <option value="125">Outdoor Activities</option>
                                            <option value="126">Outdoor Activities --&gt; Biking</option>
                                            <option value="127">Outdoor Activities --&gt; Boating</option>
                                            <option value="128">Outdoor Activities --&gt; Camping</option>
                                            <option value="129">Outdoor Activities --&gt; Canoe &amp; Kayak</option>
                                            <option value="130">Outdoor Activities --&gt; Equestrian</option>
                                            <option value="131">Outdoor Activities --&gt; Fishing</option>
                                            <option value="132">Outdoor Activities --&gt; Golf</option>
                                            <option value="133">Outdoor Activities --&gt; Hiking</option>
                                            <option value="134">Outdoor Activities --&gt; Hunting</option>
                                            <option value="135">Outdoor Activities --&gt; Skateboarding</option>
                                            <option value="136">Politics &amp; Society</option>
                                            <option value="137">Politics &amp; Society --&gt; Charities &amp; Non-Profits</option>
                                            <option value="138">Politics &amp; Society --&gt; Environmental Issues</option>
                                            <option value="139">Politics &amp; Society --&gt; Politics</option>
                                            <option value="140">Politics &amp; Society --&gt; World Affairs</option>
                                            <option value="141">Retail</option>
                                            <option value="142">Retail --&gt; Art &amp; Collectibles</option>
                                            <option value="143">Retail --&gt; Automotive Parts &amp; Accessories</option>
                                            <option value="144">Retail --&gt; Babies &amp; Kids</option>
                                            <option value="145">Retail --&gt; Business &amp; Office</option>
                                            <option value="146">Retail --&gt; Cell Phones / Mobiles &amp; Plans</option>
                                            <option value="147">Retail --&gt; Clothing, Shoes &amp; Accessories</option>
                                            <option value="148">Retail --&gt; Computers</option>
                                            <option value="149">Retail --&gt; Consumer Packaged Goods (CPG)</option>
                                            <option value="150">Retail --&gt; Electronics</option>
                                            <option value="151">Retail --&gt; Entertainment</option>
                                            <option value="152">Retail --&gt; Hobbies, Games &amp; Toys</option>
                                            <option value="153">Retail --&gt; Home &amp; Garden</option>
                                            <option value="154">Retail --&gt; Shopping Predictors</option>
                                            <option value="155">Retail --&gt; Sports Equipment &amp; Outdoor Gear</option>
                                            <option value="156">Retail --&gt; Video Games</option>
                                            <option value="157">Science &amp; Humanities</option>
                                            <option value="158">Science &amp; Humanities --&gt; Anthropology</option>
                                            <option value="159">Science &amp; Humanities --&gt; Astronomy</option>
                                            <option value="160">Science &amp; Humanities --&gt; Biological Sciences</option>
                                            <option value="161">Science &amp; Humanities --&gt; Botany</option>
                                            <option value="162">Science &amp; Humanities --&gt; Chemistry</option>
                                            <option value="163">Science &amp; Humanities --&gt; Engineering</option>
                                            <option value="164">Science &amp; Humanities --&gt; Geology</option>
                                            <option value="165">Science &amp; Humanities --&gt; History</option>
                                            <option value="166">Science &amp; Humanities --&gt; Marine Biology &amp; Oceanography</option>
                                            <option value="167">Science &amp; Humanities --&gt; Mathematics</option>
                                            <option value="168">Science &amp; Humanities --&gt; Meteorology &amp; Climatology</option>
                                            <option value="169">Science &amp; Humanities --&gt; Philosophy</option>
                                            <option value="170">Science &amp; Humanities --&gt; Physics</option>
                                            <option value="171">Services</option>
                                            <option value="172">Services --&gt; Arts &amp; Entertainment</option>
                                            <option value="173">Services --&gt; Facilities</option>
                                            <option value="174">Services --&gt; Housing</option>
                                            <option value="175">Services --&gt; Restaurants</option>
                                            <option value="176">Services --&gt; Services</option>
                                            <option value="177">Shopping</option>
                                            <option value="178">Shopping --&gt; Apparel &amp; Accessories</option>
                                            <option value="179">Shopping --&gt; Auctions</option>
                                            <option value="180">Shopping --&gt; Bargain Hunting</option>
                                            <option value="181">Shopping --&gt; Children</option>
                                            <option value="182">Shopping --&gt; Coupons</option>
                                            <option value="183">Shopping --&gt; Department Stores</option>
                                            <option value="184">Shopping --&gt; Fashion</option>
                                            <option value="185">Shopping --&gt; Impulse Buyers</option>
                                            <option value="186">Shopping --&gt; Luxury Goods</option>
                                            <option value="187">Shopping --&gt; Mail Order</option>
                                            <option value="188">Shopping --&gt; Online Shoppers</option>
                                            <option value="189">Shopping --&gt; Shopaholics</option>
                                            <option value="190">Sports</option>
                                            <option value="191">Sports --&gt; Aerobics</option>
                                            <option value="192">Sports --&gt; Boxing/Martial Arts/Wrestling</option>
                                            <option value="193">Sports --&gt; Cycling</option>
                                            <option value="194">Sports --&gt; Extreme Sports</option>
                                            <option value="195">Sports --&gt; Golf</option>
                                            <option value="196">Sports --&gt; Motor Sports</option>
                                            <option value="197">Sports --&gt; Nascar</option>
                                            <option value="198">Sports --&gt; Olympics &amp; International Competitions</option>
                                            <option value="199">Sports --&gt; Racquet Sports</option>
                                            <option value="200">Sports --&gt; Running/Jogging</option>
                                            <option value="201">Sports --&gt; Team Sports</option>
                                            <option value="202">Sports --&gt; Walking</option>
                                            <option value="203">Sports --&gt; Water Sports</option>
                                            <option value="204">Sports --&gt; Winter Sports</option>
                                            <option value="205">Travel</option>
                                            <option value="206">Travel --&gt; Air Travel</option>
                                            <option value="207">Travel --&gt; Budget Travel</option>
                                            <option value="208">Travel --&gt; Business Travel - International</option>
                                            <option value="209">Travel --&gt; Business Travel - USA</option>
                                            <option value="210">Travel --&gt; Car Rentals</option>
                                            <option value="211">Travel --&gt; Cruises &amp; Charters</option>
                                            <option value="212">Travel --&gt; Hotels &amp; Lodging?</option>
                                            <option value="213">Travel --&gt; Personal Travel - International</option>
                                            <option value="214">Travel --&gt; Personal Travel - USA</option>
                                            <option value="215">Travel --&gt; Resorts</option>
                                            <option value="216">Travel --&gt; Vacation Packages</option>
                                            <option value="217">Video Games</option>
                                            <option value="218">Video Games --&gt; Games</option>
                                            <option value="219">Video Games --&gt; Systems</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Secondary Category</label>
                                        <select className="form-select" value={form.marketingInfo.secondaryCategory} onChange={e => handleChange('marketingInfo', 'secondaryCategory', e.target.value)}>
                                            <option value="1">Animals</option>
                                            <option value="2">Animals --&gt; Pets</option>
                                            <option value="3">Animals --&gt; Wildlife</option>
                                            <option value="4">Arts &amp; Entertainment</option>
                                            <option value="5">Arts &amp; Entertainment --&gt; Amusement Parks</option>
                                            <option value="6">Arts &amp; Entertainment --&gt; Clubs &amp; Nightlife</option>
                                            <option value="7">Arts &amp; Entertainment --&gt; Comedy</option>
                                            <option value="8">Arts &amp; Entertainment --&gt; Film &amp; Television</option>
                                            <option value="9">Arts &amp; Entertainment --&gt; Games</option>
                                            <option value="10">Arts &amp; Entertainment --&gt; Music</option>
                                            <option value="11">Arts &amp; Entertainment --&gt; Pop Culture</option>
                                            <option value="12">Arts &amp; Entertainment --&gt; Reading</option>
                                            <option value="13">Arts &amp; Entertainment --&gt; Theater &amp; Performing Arts</option>
                                            <option value="14">Arts &amp; Entertainment --&gt; Visual Arts</option>
                                            <option value="15">Autos</option>
                                            <option value="16">Business &amp; Finance</option>
                                            <option value="17">Business &amp; Finance --&gt; Advertising &amp; Marketing</option>
                                            <option value="18">Business &amp; Finance --&gt; Billing</option>
                                            <option value="19">Business &amp; Finance --&gt; Careers</option>
                                            <option value="20">Business &amp; Finance --&gt; Finance &amp; Investing</option>
                                            <option value="21">Business &amp; Finance --&gt; Home Office</option>
                                            <option value="22">Business &amp; Finance --&gt; Insurance</option>
                                            <option value="23">Business &amp; Finance --&gt; Management &amp; Corporate Operations</option>
                                            <option value="24">Business &amp; Finance --&gt; Marketing &amp; PR</option>
                                            <option value="25">Business &amp; Finance --&gt; Small Business</option>
                                            <option value="26">Education</option>
                                            <option value="27">Education --&gt; Career Advice</option>
                                            <option value="28">Education --&gt; College</option>
                                            <option value="29">Education --&gt; Financial Aid</option>
                                            <option value="30">Education --&gt; Foreign Language</option>
                                            <option value="31">Education --&gt; Home Schooling</option>
                                            <option value="32">Education --&gt; Home Study Courses</option>
                                            <option value="33">Education --&gt; Study Skills</option>
                                            <option value="34">Education --&gt; Teaching Resources</option>
                                            <option value="35">Electronics &amp; Computers</option>
                                            <option value="36">Electronics &amp; Computers --&gt; Brands</option>
                                            <option value="37">Electronics &amp; Computers --&gt; Cameras</option>
                                            <option value="38">Cell Phones / Mobiles</option>
                                            <option value="39">Electronics &amp; Computers --&gt; Components</option>
                                            <option value="40">Electronics &amp; Computers --&gt; Computers</option>
                                            <option value="41">Electronics &amp; Computers --&gt; Handhelds &amp; PDAs</option>
                                            <option value="42">Electronics &amp; Computers --&gt; Internet Service Providers</option>
                                            <option value="43">Electronics &amp; Computers --&gt; Music Players</option>
                                            <option value="44">Electronics &amp; Computers --&gt; Networking &amp; Wireless</option>
                                            <option value="45">Electronics &amp; Computers --&gt; Personal Electronics</option>
                                            <option value="46">Electronics &amp; Computers --&gt; Programming</option>
                                            <option value="47">Electronics &amp; Computers --&gt; Software</option>
                                            <option value="48">Electronics &amp; Computers --&gt; Televisions</option>
                                            <option value="49">Financial Products &amp; Services</option>
                                            <option value="50">Financial Products &amp; Services --&gt; Banking</option>
                                            <option value="51">Financial Products &amp; Services --&gt; Credit Products</option>
                                            <option value="52">Financial Products &amp; Services --&gt; Financial Services</option>
                                            <option value="53">Financial Products &amp; Services --&gt; Insurance</option>
                                            <option value="54">Financial Products &amp; Services --&gt; Loans</option>
                                            <option value="55">Financial Products &amp; Services --&gt; Payroll &amp; Payment</option>
                                            <option value="56">Financial Products &amp; Services --&gt; Retirement &amp; Investing</option>
                                            <option value="57">Food &amp; Drink</option>
                                            <option value="58">Food &amp; Drink --&gt; Baking</option>
                                            <option value="59">Food &amp; Drink --&gt; Coffee</option>
                                            <option value="60">Food &amp; Drink --&gt; Cooking</option>
                                            <option value="61">Food &amp; Drink --&gt; Cuisine Types</option>
                                            <option value="62">Food &amp; Drink --&gt; Health Food</option>
                                            <option value="63">Food &amp; Drink --&gt; Natural Foods</option>
                                            <option value="64">Food &amp; Drink --&gt; Restaurants</option>
                                            <option value="65">Food &amp; Drink --&gt; Snacks</option>
                                            <option value="66">Health, Beauty &amp; Personal Care</option>
                                            <option value="67">Health, Beauty &amp; Personal Care --&gt; Body Art</option>
                                            <option value="68">Health, Beauty &amp; Personal Care --&gt; Face &amp; Body Care</option>
                                            <option value="69">Health, Beauty &amp; Personal Care --&gt; Fitness</option>
                                            <option value="70">Health, Beauty &amp; Personal Care --&gt; Hair Care</option>
                                            <option value="71">Health, Beauty &amp; Personal Care --&gt; Health</option>
                                            <option value="72">Health, Beauty &amp; Personal Care --&gt; Nutrition</option>
                                            <option value="73">Hobbies</option>
                                            <option value="74">Hobbies --&gt; Auto Work</option>
                                            <option value="75">Hobbies --&gt; Collecting</option>
                                            <option value="76">Hobbies --&gt; Handicrafts</option>
                                            <option value="77">Hobbies --&gt; Music</option>
                                            <option value="78">Hobbies --&gt; Photography</option>
                                            <option value="79">Hobbies --&gt; Writing</option>
                                            <option value="80">Home &amp; Garden</option>
                                            <option value="81">Home &amp; Garden --&gt; Gardening</option>
                                            <option value="82">Home &amp; Garden --&gt; Home Furnishings &amp; Decorating</option>
                                            <option value="83">Home &amp; Garden --&gt; Home Improvement</option>
                                            <option value="84">Home &amp; Garden --&gt; Housewares</option>
                                            <option value="85">Internet &amp; Online Activities</option>
                                            <option value="86">Internet &amp; Online Activities --&gt; Apps</option>
                                            <option value="87">Internet &amp; Online Activities --&gt; Blogs</option>
                                            <option value="88">Internet &amp; Online Activities --&gt; File Sharing &amp; Hosting</option>
                                            <option value="89">Internet &amp; Online Activities --&gt; Games &amp; Quizzes</option>
                                            <option value="90">Internet &amp; Online Activities --&gt; Navigation</option>
                                            <option value="91">Internet &amp; Online Activities --&gt; News</option>
                                            <option value="92">Internet &amp; Online Activities --&gt; Online Dating</option>
                                            <option value="93">Internet &amp; Online Activities --&gt; Photo Sharing</option>
                                            <option value="94">Internet &amp; Online Activities --&gt; Research</option>
                                            <option value="95">Internet &amp; Online Activities --&gt; Shopping</option>
                                            <option value="96">Internet &amp; Online Activities --&gt; Site Building</option>
                                            <option value="97">Internet &amp; Online Activities --&gt; Social Networking</option>
                                            <option value="98">Internet &amp; Online Activities --&gt; Streaming</option>
                                            <option value="99">Internet &amp; Online Activities --&gt; Video Sharing</option>
                                            <option value="100">Lifestyles</option>
                                            <option value="101">Lifestyles --&gt; Clubs &amp; Organizations</option>
                                            <option value="102">Lifestyles --&gt; Country Club Members</option>
                                            <option value="103">Lifestyles --&gt; Do It Yourselfers (DIY)</option>
                                            <option value="104">Lifestyles --&gt; Gift Giving</option>
                                            <option value="105">Lifestyles --&gt; Green Living</option>
                                            <option value="106">Lifestyles --&gt; Healthy Living</option>
                                            <option value="107">Lifestyles --&gt; Holidays &amp; Seasonal Events</option>
                                            <option value="108">Lifestyles --&gt; Home Entertaining</option>
                                            <option value="109">Lifestyles --&gt; Luxury Pursuits</option>
                                            <option value="110">Lifestyles --&gt; Military</option>
                                            <option value="111">Lifestyles --&gt; Opinion Leaders</option>
                                            <option value="112">Lifestyles --&gt; Parenting &amp; Family</option>
                                            <option value="113">Lifestyles --&gt; Rural Farming</option>
                                            <option value="114">Lifestyles --&gt; Self-Improvement</option>
                                            <option value="115">Lifestyles --&gt; Wedding Planning</option>
                                            <option value="116">Other Vehicles</option>
                                            <option value="117">Other Vehicles? --&gt; Aircraft</option>
                                            <option value="118">Other Vehicles? --&gt; Boats</option>
                                            <option value="119">Other Vehicles? --&gt; Golf Carts</option>
                                            <option value="120">Other Vehicles? --&gt; Heavy Equipment</option>
                                            <option value="121">Other Vehicles? --&gt; Military Vehicles</option>
                                            <option value="122">Other Vehicles? --&gt; Motorcycles &amp; ATVs</option>
                                            <option value="123">Other Vehicles? --&gt; RVs, Campers &amp; Trailers</option>
                                            <option value="124">Other Vehicles? --&gt; Snowmobiles</option>
                                            <option value="125">Outdoor Activities</option>
                                            <option value="126">Outdoor Activities --&gt; Biking</option>
                                            <option value="127">Outdoor Activities --&gt; Boating</option>
                                            <option value="128">Outdoor Activities --&gt; Camping</option>
                                            <option value="129">Outdoor Activities --&gt; Canoe &amp; Kayak</option>
                                            <option value="130">Outdoor Activities --&gt; Equestrian</option>
                                            <option value="131">Outdoor Activities --&gt; Fishing</option>
                                            <option value="132">Outdoor Activities --&gt; Golf</option>
                                            <option value="133">Outdoor Activities --&gt; Hiking</option>
                                            <option value="134">Outdoor Activities --&gt; Hunting</option>
                                            <option value="135">Outdoor Activities --&gt; Skateboarding</option>
                                            <option value="136">Politics &amp; Society</option>
                                            <option value="137">Politics &amp; Society --&gt; Charities &amp; Non-Profits</option>
                                            <option value="138">Politics &amp; Society --&gt; Environmental Issues</option>
                                            <option value="139">Politics &amp; Society --&gt; Politics</option>
                                            <option value="140">Politics &amp; Society --&gt; World Affairs</option>
                                            <option value="141">Retail</option>
                                            <option value="142">Retail --&gt; Art &amp; Collectibles</option>
                                            <option value="143">Retail --&gt; Automotive Parts &amp; Accessories</option>
                                            <option value="144">Retail --&gt; Babies &amp; Kids</option>
                                            <option value="145">Retail --&gt; Business &amp; Office</option>
                                            <option value="146">Retail --&gt; Cell Phones / Mobiles &amp; Plans</option>
                                            <option value="147">Retail --&gt; Clothing, Shoes &amp; Accessories</option>
                                            <option value="148">Retail --&gt; Computers</option>
                                            <option value="149">Retail --&gt; Consumer Packaged Goods (CPG)</option>
                                            <option value="150">Retail --&gt; Electronics</option>
                                            <option value="151">Retail --&gt; Entertainment</option>
                                            <option value="152">Retail --&gt; Hobbies, Games &amp; Toys</option>
                                            <option value="153">Retail --&gt; Home &amp; Garden</option>
                                            <option value="154">Retail --&gt; Shopping Predictors</option>
                                            <option value="155">Retail --&gt; Sports Equipment &amp; Outdoor Gear</option>
                                            <option value="156">Retail --&gt; Video Games</option>
                                            <option value="157">Science &amp; Humanities</option>
                                            <option value="158">Science &amp; Humanities --&gt; Anthropology</option>
                                            <option value="159">Science &amp; Humanities --&gt; Astronomy</option>
                                            <option value="160">Science &amp; Humanities --&gt; Biological Sciences</option>
                                            <option value="161">Science &amp; Humanities --&gt; Botany</option>
                                            <option value="162">Science &amp; Humanities --&gt; Chemistry</option>
                                            <option value="163">Science &amp; Humanities --&gt; Engineering</option>
                                            <option value="164">Science &amp; Humanities --&gt; Geology</option>
                                            <option value="165">Science &amp; Humanities --&gt; History</option>
                                            <option value="166">Science &amp; Humanities --&gt; Marine Biology &amp; Oceanography</option>
                                            <option value="167">Science &amp; Humanities --&gt; Mathematics</option>
                                            <option value="168">Science &amp; Humanities --&gt; Meteorology &amp; Climatology</option>
                                            <option value="169">Science &amp; Humanities --&gt; Philosophy</option>
                                            <option value="170">Science &amp; Humanities --&gt; Physics</option>
                                            <option value="171">Services</option>
                                            <option value="172">Services --&gt; Arts &amp; Entertainment</option>
                                            <option value="173">Services --&gt; Facilities</option>
                                            <option value="174">Services --&gt; Housing</option>
                                            <option value="175">Services --&gt; Restaurants</option>
                                            <option value="176">Services --&gt; Services</option>
                                            <option value="177">Shopping</option>
                                            <option value="178">Shopping --&gt; Apparel &amp; Accessories</option>
                                            <option value="179">Shopping --&gt; Auctions</option>
                                            <option value="180">Shopping --&gt; Bargain Hunting</option>
                                            <option value="181">Shopping --&gt; Children</option>
                                            <option value="182">Shopping --&gt; Coupons</option>
                                            <option value="183">Shopping --&gt; Department Stores</option>
                                            <option value="184">Shopping --&gt; Fashion</option>
                                            <option value="185">Shopping --&gt; Impulse Buyers</option>
                                            <option value="186">Shopping --&gt; Luxury Goods</option>
                                            <option value="187">Shopping --&gt; Mail Order</option>
                                            <option value="188">Shopping --&gt; Online Shoppers</option>
                                            <option value="189">Shopping --&gt; Shopaholics</option>
                                            <option value="190">Sports</option>
                                            <option value="191">Sports --&gt; Aerobics</option>
                                            <option value="192">Sports --&gt; Boxing/Martial Arts/Wrestling</option>
                                            <option value="193">Sports --&gt; Cycling</option>
                                            <option value="194">Sports --&gt; Extreme Sports</option>
                                            <option value="195">Sports --&gt; Golf</option>
                                            <option value="196">Sports --&gt; Motor Sports</option>
                                            <option value="197">Sports --&gt; Nascar</option>
                                            <option value="198">Sports --&gt; Olympics &amp; International Competitions</option>
                                            <option value="199">Sports --&gt; Racquet Sports</option>
                                            <option value="200">Sports --&gt; Running/Jogging</option>
                                            <option value="201">Sports --&gt; Team Sports</option>
                                            <option value="202">Sports --&gt; Walking</option>
                                            <option value="203">Sports --&gt; Water Sports</option>
                                            <option value="204">Sports --&gt; Winter Sports</option>
                                            <option value="205">Travel</option>
                                            <option value="206">Travel --&gt; Air Travel</option>
                                            <option value="207">Travel --&gt; Budget Travel</option>
                                            <option value="208">Travel --&gt; Business Travel - International</option>
                                            <option value="209">Travel --&gt; Business Travel - USA</option>
                                            <option value="210">Travel --&gt; Car Rentals</option>
                                            <option value="211">Travel --&gt; Cruises &amp; Charters</option>
                                            <option value="212">Travel --&gt; Hotels &amp; Lodging?</option>
                                            <option value="213">Travel --&gt; Personal Travel - International</option>
                                            <option value="214">Travel --&gt; Personal Travel - USA</option>
                                            <option value="215">Travel --&gt; Resorts</option>
                                            <option value="216">Travel --&gt; Vacation Packages</option>
                                            <option value="217">Video Games</option>
                                            <option value="218">Video Games --&gt; Games</option>
                                            <option value="219">Video Games --&gt; Systems</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Comments</label>
                                        <textarea className="form-control" rows="3"
                                            value={form.marketingInfo.comments} onChange={e => handleChange('marketingInfo', 'comments', e.target.value)} />
                                    </div>
                                    <br />

                                    {/* Contact Information */}
                                    <h5 className="section-title border-bottom pb-2 mb-3 mt-4">Contact Information</h5>
                                    <div className="row g-2 mb-3">
                                        <div className="col-md-6">
                                            <label className="form-label small text-muted">First Name <span className="text-danger">*</span></label>
                                            <input type="text" className={`form-control ${errors['accountInfo.firstName'] ? 'is-invalid' : ''}`} required placeholder="Enter First Name"
                                                value={form.accountInfo.firstName} onChange={e => handleChange('accountInfo', 'firstName', e.target.value)} />
                                            <div className="invalid-feedback">{errors['accountInfo.firstName']}</div>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small text-muted">Last Name <span className="text-danger">*</span></label>
                                            <input type="text" className={`form-control ${errors['accountInfo.lastName'] ? 'is-invalid' : ''}`} required placeholder="Enter Last Name"
                                                value={form.accountInfo.lastName} onChange={e => handleChange('accountInfo', 'lastName', e.target.value)} />
                                            <div className="invalid-feedback">{errors['accountInfo.lastName']}</div>
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Job Title</label>
                                        <input type="text" className="form-control" placeholder="Enter Job Title"
                                            value={form.accountInfo.title} onChange={e => handleChange('accountInfo', 'title', e.target.value)} />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Work Phone <span className="text-danger">*</span></label>
                                        <input type="text" className={`form-control ${errors['accountInfo.workPhone'] ? 'is-invalid' : ''}`} required placeholder="Enter Work Phone"
                                            value={form.accountInfo.workPhone} onChange={e => handleChange('accountInfo', 'workPhone', e.target.value)} />
                                        <div className="invalid-feedback">{errors['accountInfo.workPhone']}</div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Cell Phone</label>
                                        <input type="text" className="form-control" placeholder="Enter Cell Phone"
                                            value={form.accountInfo.cellPhone} onChange={e => handleChange('accountInfo', 'cellPhone', e.target.value)} />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Fax</label>
                                        <input type="text" className="form-control" placeholder="Enter Fax"
                                            value={form.accountInfo.fax} onChange={e => handleChange('accountInfo', 'fax', e.target.value)} />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Email <span className="text-danger">*</span></label>
                                        <input type="email" className={`form-control ${errors['accountInfo.email'] ? 'is-invalid' : ''}`} required placeholder="Enter Email Address"
                                            value={form.accountInfo.email} onChange={e => handleChange('accountInfo', 'email', e.target.value)} />
                                        <div className="invalid-feedback">{errors['accountInfo.email']}</div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Timezone</label>
                                        <select className="form-select" value={form.accountInfo.timezone} onChange={e => handleChange('accountInfo', 'timezone', e.target.value)}>
                                            <option value=""></option>
                                            <option value="Dateline Standard Time">Dateline Standard Time</option>
                                            <option value="UTC-11">UTC-11</option>
                                            <option value="Aleutian Standard Time">Aleutian Standard Time</option>
                                            <option value="Hawaiian Standard Time">Hawaiian Standard Time</option>
                                            <option value="Marquesas Standard Time">Marquesas Standard Time</option>
                                            <option value="Alaskan Standard Time">Alaskan Standard Time</option>
                                            <option value="UTC-09">UTC-09</option>
                                            <option value="Pacific Standard Time (Mexico)">Pacific Standard Time (Mexico)</option>
                                            <option value="UTC-08">UTC-08</option>
                                            <option value="Pacific Standard Time">Pacific Standard Time</option>
                                            <option value="US Mountain Standard Time">US Mountain Standard Time</option>
                                            <option value="Mountain Standard Time (Mexico)">Mountain Standard Time (Mexico)</option>
                                            <option value="Mountain Standard Time">Mountain Standard Time</option>
                                            <option value="Yukon Standard Time">Yukon Standard Time</option>
                                            <option value="Central America Standard Time">Central America Standard Time</option>
                                            <option value="Central Standard Time">Central Standard Time</option>
                                            <option value="Easter Island Standard Time">Easter Island Standard Time</option>
                                            <option value="Central Standard Time (Mexico)">Central Standard Time (Mexico)</option>
                                            <option value="Canada Central Standard Time">Canada Central Standard Time</option>
                                            <option value="SA Pacific Standard Time">SA Pacific Standard Time</option>
                                            <option value="Eastern Standard Time (Mexico)">Eastern Standard Time (Mexico)</option>
                                            <option value="Eastern Standard Time">Eastern Standard Time</option>
                                            <option value="Haiti Standard Time">Haiti Standard Time</option>
                                            <option value="Cuba Standard Time">Cuba Standard Time</option>
                                            <option value="US Eastern Standard Time">US Eastern Standard Time</option>
                                            <option value="Turks And Caicos Standard Time">Turks and Caicos Standard Time</option>
                                            <option value="Paraguay Standard Time">Paraguay Standard Time</option>
                                            <option value="Atlantic Standard Time">Atlantic Standard Time</option>
                                            <option value="Venezuela Standard Time">Venezuela Standard Time</option>
                                            <option value="Central Brazilian Standard Time">Central Brazilian Standard Time</option>
                                            <option value="SA Western Standard Time">SA Western Standard Time</option>
                                            <option value="Pacific SA Standard Time">Pacific SA Standard Time</option>
                                            <option value="Newfoundland Standard Time">Newfoundland Standard Time</option>
                                            <option value="Tocantins Standard Time">Tocantins Standard Time</option>
                                            <option value="E. South America Standard Time">E. South America Standard Time</option>
                                            <option value="SA Eastern Standard Time">SA Eastern Standard Time</option>
                                            <option value="Argentina Standard Time">Argentina Standard Time</option>
                                            <option value="Greenland Standard Time">Greenland Standard Time</option>
                                            <option value="Montevideo Standard Time">Montevideo Standard Time</option>
                                            <option value="Magallanes Standard Time">Magallanes Standard Time</option>
                                            <option value="Saint Pierre Standard Time">Saint Pierre Standard Time</option>
                                            <option value="Bahia Standard Time">Bahia Standard Time</option>
                                            <option value="UTC-02">UTC-02</option>
                                            <option value="Mid-Atlantic Standard Time">Mid-Atlantic Standard Time</option>
                                            <option value="Azores Standard Time">Azores Standard Time</option>
                                            <option value="Cape Verde Standard Time">Cabo Verde Standard Time</option>
                                            <option value="UTC">Coordinated Universal Time</option>
                                            <option value="GMT Standard Time">GMT Standard Time</option>
                                            <option value="Greenwich Standard Time">Greenwich Standard Time</option>
                                            <option value="Sao Tome Standard Time">Sao Tome Standard Time</option>
                                            <option value="Morocco Standard Time">Morocco Standard Time</option>
                                            <option value="W. Europe Standard Time">W. Europe Standard Time</option>
                                            <option value="Central Europe Standard Time">Central Europe Standard Time</option>
                                            <option value="Romance Standard Time">Romance Standard Time</option>
                                            <option value="Central European Standard Time">Central European Standard Time</option>
                                            <option value="W. Central Africa Standard Time">W. Central Africa Standard Time</option>
                                            <option value="GTB Standard Time">GTB Standard Time</option>
                                            <option value="Middle East Standard Time">Middle East Standard Time</option>
                                            <option value="Egypt Standard Time">Egypt Standard Time</option>
                                            <option value="E. Europe Standard Time">E. Europe Standard Time</option>
                                            <option value="Syria Standard Time">Syria Standard Time</option>
                                            <option value="West Bank Standard Time">West Bank Gaza Standard Time</option>
                                            <option value="South Africa Standard Time">South Africa Standard Time</option>
                                            <option value="FLE Standard Time">FLE Standard Time</option>
                                            <option value="Israel Standard Time">Jerusalem Standard Time</option>
                                            <option value="South Sudan Standard Time">South Sudan Standard Time</option>
                                            <option value="Kaliningrad Standard Time">Russia TZ 1 Standard Time</option>
                                            <option value="Sudan Standard Time">Sudan Standard Time</option>
                                            <option value="Libya Standard Time">Libya Standard Time</option>
                                            <option value="Namibia Standard Time">Namibia Standard Time</option>
                                            <option value="Jordan Standard Time">Jordan Standard Time</option>
                                            <option value="Arabic Standard Time">Arabic Standard Time</option>
                                            <option value="Turkey Standard Time">Turkey Standard Time</option>
                                            <option value="Arab Standard Time">Arab Standard Time</option>
                                            <option value="Belarus Standard Time">Belarus Standard Time</option>
                                            <option value="Russian Standard Time">Russia TZ 2 Standard Time</option>
                                            <option value="E. Africa Standard Time">E. Africa Standard Time</option>
                                            <option value="Volgograd Standard Time">Volgograd Standard Time</option>
                                            <option value="Iran Standard Time">Iran Standard Time</option>
                                            <option value="Arabian Standard Time">Arabian Standard Time</option>
                                            <option value="Astrakhan Standard Time">Astrakhan Standard Time</option>
                                            <option value="Azerbaijan Standard Time">Azerbaijan Standard Time</option>
                                            <option value="Russia Time Zone 3">Russia TZ 3 Standard Time</option>
                                            <option value="Mauritius Standard Time">Mauritius Standard Time</option>
                                            <option value="Saratov Standard Time">Saratov Standard Time</option>
                                            <option value="Georgian Standard Time">Georgian Standard Time</option>
                                            <option value="Caucasus Standard Time">Caucasus Standard Time</option>
                                            <option value="Afghanistan Standard Time">Afghanistan Standard Time</option>
                                            <option value="West Asia Standard Time">West Asia Standard Time</option>
                                            <option value="Ekaterinburg Standard Time">Russia TZ 4 Standard Time</option>
                                            <option value="Pakistan Standard Time">Pakistan Standard Time</option>
                                            <option value="Qyzylorda Standard Time">Qyzylorda Standard Time</option>
                                            <option value="India Standard Time">India Standard Time</option>
                                            <option value="Sri Lanka Standard Time">Sri Lanka Standard Time</option>
                                            <option value="Nepal Standard Time">Nepal Standard Time</option>
                                            <option value="Central Asia Standard Time">Central Asia Standard Time</option>
                                            <option value="Bangladesh Standard Time">Bangladesh Standard Time</option>
                                            <option value="Omsk Standard Time">Omsk Standard Time</option>
                                            <option value="Myanmar Standard Time">Myanmar Standard Time</option>
                                            <option value="SE Asia Standard Time">SE Asia Standard Time</option>
                                            <option value="Altai Standard Time">Altai Standard Time</option>
                                            <option value="W. Mongolia Standard Time">W. Mongolia Standard Time</option>
                                            <option value="North Asia Standard Time">Russia TZ 6 Standard Time</option>
                                            <option value="N. Central Asia Standard Time">Novosibirsk Standard Time</option>
                                            <option value="Tomsk Standard Time">Tomsk Standard Time</option>
                                            <option value="China Standard Time">China Standard Time</option>
                                            <option value="North Asia East Standard Time">Russia TZ 7 Standard Time</option>
                                            <option value="Singapore Standard Time">Malay Peninsula Standard Time</option>
                                            <option value="W. Australia Standard Time">W. Australia Standard Time</option>
                                            <option value="Taipei Standard Time">Taipei Standard Time</option>
                                            <option value="Ulaanbaatar Standard Time">Ulaanbaatar Standard Time</option>
                                            <option value="Aus Central W. Standard Time">Aus Central W. Standard Time</option>
                                            <option value="Transbaikal Standard Time">Transbaikal Standard Time</option>
                                            <option value="Tokyo Standard Time">Tokyo Standard Time</option>
                                            <option value="North Korea Standard Time">North Korea Standard Time</option>
                                            <option value="Korea Standard Time">Korea Standard Time</option>
                                            <option value="Yakutsk Standard Time">Russia TZ 8 Standard Time</option>
                                            <option value="Cen. Australia Standard Time">Cen. Australia Standard Time</option>
                                            <option value="AUS Central Standard Time">AUS Central Standard Time</option>
                                            <option value="E. Australia Standard Time">E. Australia Standard Time</option>
                                            <option value="AUS Eastern Standard Time">AUS Eastern Standard Time</option>
                                            <option value="West Pacific Standard Time">West Pacific Standard Time</option>
                                            <option value="Tasmania Standard Time">Tasmania Standard Time</option>
                                            <option value="Vladivostok Standard Time">Russia TZ 9 Standard Time</option>
                                            <option value="Lord Howe Standard Time">Lord Howe Standard Time</option>
                                            <option value="Bougainville Standard Time">Bougainville Standard Time</option>
                                            <option value="Russia Time Zone 10">Russia TZ 10 Standard Time</option>
                                            <option value="Magadan Standard Time">Magadan Standard Time</option>
                                            <option value="Norfolk Standard Time">Norfolk Standard Time</option>
                                            <option value="Sakhalin Standard Time">Sakhalin Standard Time</option>
                                            <option value="Central Pacific Standard Time">Central Pacific Standard Time</option>
                                            <option value="Russia Time Zone 11">Russia TZ 11 Standard Time</option>
                                            <option value="New Zealand Standard Time">New Zealand Standard Time</option>
                                            <option value="UTC+12">UTC+12</option>
                                            <option value="Fiji Standard Time">Fiji Standard Time</option>
                                            <option value="Kamchatka Standard Time">Kamchatka Standard Time</option>
                                            <option value="Chatham Islands Standard Time">Chatham Islands Standard Time</option>
                                            <option value="UTC+13">UTC+13</option>
                                            <option value="Tonga Standard Time">Tonga Standard Time</option>
                                            <option value="Samoa Standard Time">Samoa Standard Time</option>
                                            <option value="Line Islands Standard Time">Line Islands Standard Time</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">IM</label>
                                        <div className="input-group">
                                            <select className="form-select" style={{ maxWidth: "120px" }}
                                                value={form.accountInfo.imService} onChange={e => handleChange('accountInfo', 'imService', e.target.value)}>
                                                <option value="Google">Google</option>
                                                <option value="Skype">Skype</option>
                                            </select>
                                            <input type="text" className="form-control" placeholder="Enter IM Handle"
                                                value={form.accountInfo.imHandle} onChange={e => handleChange('accountInfo', 'imHandle', e.target.value)} />
                                        </div>
                                    </div>
                                    <br />




                                    {/* Payment Information */}
                                    <h5 className="section-title border-bottom pb-2 mb-3 mt-4">Payment Information</h5>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Payment To <span className="text-danger">*</span></label>
                                        <select className={`form-select ${errors['paymentInfo.payTo'] ? 'is-invalid' : ''}`} required value={form.paymentInfo.payTo} onChange={e => handleChange('paymentInfo', 'payTo', e.target.value)}>
                                            <option value="0">Company Name</option>
                                            <option value="1">Main Contact</option>
                                        </select>
                                        <div className="invalid-feedback">{errors['paymentInfo.payTo']}</div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Currency <span className="text-danger">*</span></label>
                                        <select className={`form-select ${errors['paymentInfo.currency'] ? 'is-invalid' : ''}`} required value={form.paymentInfo.currency} onChange={e => handleChange('paymentInfo', 'currency', e.target.value)}>
                                            <option value="1">US Dollar</option>
                                            <option value="3">Euro</option>
                                            <option value="4">Indian Rupee</option>
                                        </select>
                                        <div className="invalid-feedback">{errors['paymentInfo.currency']}</div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Tax Class <span className="text-danger">*</span></label>
                                        <select className={`form-select ${errors['paymentInfo.taxClass'] ? 'is-invalid' : ''}`} required value={form.paymentInfo.taxClass} onChange={e => handleChange('paymentInfo', 'taxClass', e.target.value)}>
                                            <option value="Corporation">Corporation</option>
                                            <option value="Individual/Sole Proprietor">Individual/Sole Proprietor</option>
                                            <option value="Partners/LLC/LLP">Partners/LLC/LLP</option>
                                            <option value="Other">Other</option>
                                        </select>
                                        <div className="invalid-feedback">{errors['paymentInfo.taxClass']}</div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">SSN / Tax ID <span className="text-danger">*</span></label>
                                        <input type="text" className={`form-control ${errors['paymentInfo.ssnTaxId'] ? 'is-invalid' : ''}`} required placeholder="Enter SSN or Tax ID"
                                            value={form.paymentInfo.ssnTaxId} onChange={e => handleChange('paymentInfo', 'ssnTaxId', e.target.value)} />
                                        <div className="invalid-feedback">{errors['paymentInfo.ssnTaxId']}</div>
                                    </div>

                                    <br />
                                    {/* Terms */}
                                    <div className="d-flex justify-content-between align-items-center mt-4 mb-2 border-bottom pb-2">
                                        <h5 className="section-title mb-0">Terms and Conditions</h5>
                                        <button type="button" className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={handlePrintTerms}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-printer" viewBox="0 0 16 16">
                                                <path d="M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1" />
                                                <path d="M5 1a2 2 0 0 0-2 2v2H2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1V3a2 2 0 0 0-2-2zM4 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2H4zm1 5a2 2 0 0 0-2 2v1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v-1a2 2 0 0 0-2-2zm7 2v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1" />
                                            </svg>
                                            Print
                                        </button>
                                    </div>

                                    <div className="border p-3 mb-3 bg-white" style={{ height: '300px', overflowY: 'scroll', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: termsText }}>
                                    </div>

                                    <div className="form-check mb-4">
                                        <input className={`form-check-input ${errors['agreed'] ? 'is-invalid' : ''}`} type="checkbox" id="termsCheck"
                                            checked={form.agreed} onChange={e => handleSingleChange('agreed', e.target.checked)} />
                                        <label className="form-check-label" htmlFor="termsCheck">
                                            I agree to the Terms and Conditions <span className="text-danger">*</span>
                                        </label>
                                        <div className="invalid-feedback">{errors['agreed']}</div>
                                    </div>

                                    <div className="mb-4">
                                        <ReCAPTCHA
                                            sitekey="6LckXk4sAAAAALOcSPaV6DdMW5OQ-JX1DHudKCcM"
                                            onChange={handleCaptchaChange}
                                        />
                                        {errors['captcha'] && <div className="text-danger small mt-1">{errors['captcha']}</div>}
                                    </div>

                                    <div className="d-grid gap-2 d-md-flex justify-content-md-end">
                                        <button type="submit" className="btn btn-primary px-4">Submit Application</button>
                                    </div>

                                </form>
                            </>
                        )}
                    </div>
                </div >
            </div >
        </>
    );
}
