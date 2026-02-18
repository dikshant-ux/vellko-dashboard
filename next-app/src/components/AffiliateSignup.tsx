'use client';
import React, { useState, useEffect } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { termsText } from "./TermsText";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, Loader2, Globe, Phone, Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import { COUNTRIES, US_STATES, PAYMENT_MODELS, CATEGORIES, PAYMENT_TO, CURRENCIES, TIMEZONES, IM_SERVICES, TAX_CLASSES, APPLICATION_TYPES } from "@/constants/mappings";
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';


import { Country, State, ICountry, IState } from 'country-state-city';

export default function AffiliateSignup() {
    const [form, setForm] = useState<any>({
        companyInfo: {
            companyName: "",
            address: "",
            address2: "",
            city: "",
            state: "",
            zip: "",
            country: "US",
            corporateWebsite: "",
            referral: "",
            referral_id: ""
        },
        marketingInfo: {


            paymentModel: "1",
            applicationType: "",
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
            imService: "",
            imHandle: "",
            additionalImChannels: {}
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
    const [errors, setErrors] = useState<any>({});
    const [submitted, setSubmitted] = useState(false);
    const [ipAddress, setIpAddress] = useState("0.0.0.0");
    const [referrals, setReferrals] = useState<{ id: string, name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Dynamic Location State
    const [availableStates, setAvailableStates] = useState<IState[]>([]);

    // IM Handles State
    const [imHandles, setImHandles] = useState<Record<string, string>>({
        "Google": "",
        "Teams": "",
        "WhatsApp": "",
        "Telegram": ""
    });
    const [primaryIm, setPrimaryIm] = useState<string>("Google");

    const router = useRouter();


    console.log("AffiliateSignup: Rendering");

    useEffect(() => {
        console.log("AffiliateSignup: Module Mounted");
        // Fetch user IP address
        fetch('https://api.ipify.org?format=json')
            .then(response => response.json())
            .then(data => {
                console.log("AffiliateSignup: IP Fetched", data.ip);
                setIpAddress(data.ip);
            })
            .catch(error => {
                console.error("Error fetching IP:", error);
                // Fallback is already set in initial state
            });
    }, []);

    // Fetch referrals based on application type
    useEffect(() => {
        const applicationType = form.marketingInfo.applicationType;
        if (!applicationType) {
            // If no application type selected, fetch all referrals
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/referrers`)
                .then(res => res.json())
                .then(data => {
                    console.log("Referrals fetched:", data);
                    if (Array.isArray(data)) {
                        setReferrals(data);
                    }
                })
                .catch(err => console.error("Error fetching referrals:", err));
        } else {
            // Fetch referrals filtered by application type
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/referrers?application_type=${encodeURIComponent(applicationType)}`)
                .then(res => res.json())
                .then(data => {
                    console.log(`Referrals fetched for ${applicationType}:`, data);
                    if (Array.isArray(data)) {
                        setReferrals(data);
                        // Reset referral if current selection is not in the new list
                        if (form.companyInfo.referral && !data.some((r: any) => r.name === form.companyInfo.referral)) {
                            handleChange('companyInfo', 'referral', '');
                            handleChange('companyInfo', 'referral_id', '');
                        }
                    }
                })
                .catch(err => console.error("Error fetching referrals:", err));
        }
    }, [form.marketingInfo.applicationType]);

    // Update states when country changes
    useEffect(() => {
        const countryCode = form.companyInfo.country;
        if (countryCode) {
            const states = State.getStatesOfCountry(countryCode);
            setAvailableStates(states);

            // If current state is not in the new list, reset it
            // Unless it's a text input fallback (not implemented here yet, always dropdown)
            // Or if the list is empty (some countries might not have states in lib)
            if (states.length > 0) {
                const currentStateExists = states.some(s => s.isoCode === form.companyInfo.state);
                if (!currentStateExists) {
                    handleChange('companyInfo', 'state', '');
                }
            } else {
                // If no states found, maybe clear state or allow text input? 
                // For now, let's just clear it to avoid invalid selection
                handleChange('companyInfo', 'state', '');
            }
        } else {
            setAvailableStates([]);
            handleChange('companyInfo', 'state', '');
        }
    }, [form.companyInfo.country]);

    const handleChange = (section: any, field: any, value: any) => {
        setForm((prev: any) => ({
            ...prev,
            [section]: { ...prev[section], [field]: value }
        }));
        // Clear error for this field if it exists
        if (errors[`${section}.${field}`]) {
            setErrors((prev: any) => {
                const newErrors = { ...prev };
                delete newErrors[`${section}.${field}`];
                return newErrors;
            });
        }
    };

    const handleSingleChange = (field: any, value: any) => {
        setForm((prev: any) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev: any) => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleCaptchaChange = (value: any) => {

        setCaptchaValue(value);
    };

    const handleImChange = (service: string, value: string) => {
        setImHandles(prev => ({
            ...prev,
            [service]: value
        }));
    };

    const handleSubmit = (e: any) => {
        e.preventDefault();
        setErrors({}); // Clear previous errors

        if (isLoading) return;

        const newErrors: any = {};


        // Marketing Info Validation
        if (!form.marketingInfo.applicationType) {
            newErrors['marketingInfo.applicationType'] = "Application Type is required";
        }

        // Company Info Validation
        if (!form.companyInfo.companyName.trim()) {
            newErrors['companyInfo.companyName'] = "Company Name is required";
        } else if (form.companyInfo.companyName.length > 50) {
            newErrors['companyInfo.companyName'] = "Company Name is too long (max 50 chars)";
        }

        if (!form.companyInfo.address.trim()) newErrors['companyInfo.address'] = "Address is required";
        if (!form.companyInfo.city.trim()) newErrors['companyInfo.city'] = "City is required";

        if (!form.companyInfo.state.trim() && availableStates.length > 0) {
            // Only require state if the country has states
            newErrors['companyInfo.state'] = "Please select a state";
        }

        if (form.companyInfo.state.length > 20) {
            // ISO codes are usually 2-3 chars, but full names could be longer? 
            // Library uses ISO codes for value usually. 
            // Let's relax this check or ensure we store ISO.
            // We are storing ISO codes from the library values.
        }

        if (form.companyInfo.corporateWebsite.trim()) {
            if (form.companyInfo.corporateWebsite.length > 100) {
                newErrors['companyInfo.corporateWebsite'] = "Website URL is too long (max 100 chars)";
            } else if (!/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/.test(form.companyInfo.corporateWebsite)) {
                newErrors['companyInfo.corporateWebsite'] = "Invalid URL format (include http:// or https://)";
            }
        }

        if (!form.companyInfo.zip.trim()) {
            newErrors['companyInfo.zip'] = "Zip/Postcode is required";
        } else if (form.companyInfo.zip.length > 10) {
            newErrors['companyInfo.zip'] = "Zip Code is too long (max 10 chars)";
        }

        if (!form.companyInfo.country) newErrors['companyInfo.country'] = "Country is required";
        if (!form.companyInfo.referral) newErrors['companyInfo.referral'] = "Please select a referral source";

        // Account Info Validation
        if (!form.accountInfo.firstName.trim()) {
            newErrors['accountInfo.firstName'] = "First Name is required";
        } else if (form.accountInfo.firstName.length > 25) {
            newErrors['accountInfo.firstName'] = "First Name is too long (max 25 chars)";
        }

        if (!form.accountInfo.lastName.trim()) {
            newErrors['accountInfo.lastName'] = "Last Name is required";
        } else if (form.accountInfo.lastName.length > 25) {
            newErrors['accountInfo.lastName'] = "Last Name is too long (max 25 chars)";
        }

        if (!form.accountInfo.workPhone) {
            newErrors['accountInfo.workPhone'] = "Work Phone is required";
        } else if (!isValidPhoneNumber(form.accountInfo.workPhone)) {
            newErrors['accountInfo.workPhone'] = "Invalid phone number";
        }

        if (form.accountInfo.cellPhone && !isValidPhoneNumber(form.accountInfo.cellPhone)) {
            newErrors['accountInfo.cellPhone'] = "Invalid phone number";
        }
        if (!form.accountInfo.email.trim()) newErrors['accountInfo.email'] = "Email is required";
        else if (!/\S+@\S+\.\S+/.test(form.accountInfo.email)) newErrors['accountInfo.email'] = "Invalid email format";

        // IM Handle Validation
        const primaryHandle = imHandles[primaryIm];
        if (!primaryHandle || !primaryHandle.trim()) {
            newErrors['accountInfo.imHandle'] = "Primary IM Handle is required";
        } else if (primaryHandle.length < 3) {
            newErrors['accountInfo.imHandle'] = "IM Handle is too short (min 3 chars)";
        } else if (primaryHandle.length > 30) {
            newErrors['accountInfo.imHandle'] = "IM Handle is too long (max 30 symbols)";
        }

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



        const third_party_name = form.companyInfo.companyName.toLowerCase().replace(/\s+/g, '_').substring(0, 50); // basic slugify

        const today = new Date();
        const date_added = `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}/${today.getFullYear()}`;

        // Submit to local backend
        const targetUrl = `${process.env.NEXT_PUBLIC_API_URL}/signup`;

        setIsLoading(true);

        // Remove 'agreed' from the payload if strictly following model, but model includes it.
        // We send the whole form object which matches the Pydantic schema structure.

        // Prepare IM Data
        const finalForm = {
            ...form,
            accountInfo: {
                ...form.accountInfo,
                imService: primaryIm,
                imHandle: primaryHandle,
                additionalImChannels: imHandles
            },
            ipAddress
        };

        fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(finalForm)
        })
            .then(async (response) => {
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Submission failed');
                }
                return response.json();
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
            })
            .finally(() => {
                setIsLoading(false);
            });
    };

    const handlePrintTerms = () => {
        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Terms and Conditions</title>');
            printWindow.document.write('<style>body{font-family: Arial, sans-serif; padding: 20px; white-space: pre-wrap;}</style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write('<h2>Terms and Conditions</h2>');
            printWindow.document.write(termsText);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.print();
        }
    };


    return (
        <>
            <div className="header-bar"></div>

            <AnimatePresence>
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm"
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                    >
                        <div className="text-center">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="mb-4 d-inline-block text-danger"
                            >
                                <Loader2 size={64} />
                            </motion.div>
                            <h3 className="fw-bold text-dark">Processing Application</h3>
                            <p className="text-muted">Please wait while we submit your details...</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="container-fluid signup-page-container min-vh-100 py-4 d-flex justify-content-center">
                <div className="card shadow-sm border-0" style={{ maxWidth: "850px", width: "100%" }}>
                    <div className="card-body p-4">
                        {submitted ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center py-5"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", duration: 0.6 }}
                                    className="mb-4 d-flex justify-content-center"
                                >
                                    <div className="bg-success text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px' }}>
                                        <Check size={40} strokeWidth={3} />
                                    </div>
                                </motion.div>
                                <h2 className="fw-bold mb-3">Application Submitted!</h2>
                                <p className="lead text-muted mb-4">
                                    Thank you <strong>{form.accountInfo.firstName}</strong> for applying to the Vellko Media Affiliate Program. <br />
                                    We have received your application and will review it shortly.
                                </p>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="btn btn-dark px-5 py-2 fw-bold d-inline-flex align-items-center gap-2"
                                    onClick={() => window.location.href = '/'}
                                >
                                    Return to Home
                                    <ArrowRight size={18} />
                                </motion.button>
                            </motion.div>
                        ) : (
                            <>
                                <div className="text-center mb-4">

                                    <img src="https://eu1-us1.ckcdnassets.com/2362/logos/signuplogo.png" alt="VELLKO" className="img-fluid mb-2" style={{ maxHeight: "150px" }} />
                                    <h4 className="text-muted text-uppercase mb-2 d-block" style={{ fontSize: '1.8rem', letterSpacing: '1px' }}>Vellko Media Affiliate Signup</h4>
                                    {/* Fallback for logo if image missing */}
                                    <h1 className="fw-bold text-danger d-none">VELLKO</h1>
                                </div>

                                {Object.keys(errors).length > 0 && (
                                    <div className="alert alert-danger text-center" role="alert">
                                        Please correct the errors below.
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} noValidate className="p-3">

                                    {/* Application Type Selection - Interactive Cards */}
                                    <div className="mb-4">
                                        <h6 className="text-center mb-3 fw-bold text-dark">What type of traffic do you want to promote?</h6>
                                        <div className="row g-2">
                                            <div className="col-md-4">
                                                <div
                                                    onClick={() => handleChange('marketingInfo', 'applicationType', 'Web Traffic')}
                                                    className={`card h-100 border-2 cursor-pointer transition-all ${form.marketingInfo.applicationType === 'Web Traffic'
                                                        ? 'border-danger shadow-lg bg-danger bg-opacity-10'
                                                        : 'border-secondary hover:border-danger hover:shadow'
                                                        }`}
                                                    style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                                                >
                                                    <div className="card-body text-center p-3">
                                                        <div className={`rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center ${form.marketingInfo.applicationType === 'Web Traffic' ? 'bg-danger' : 'bg-secondary bg-opacity-25'
                                                            }`} style={{ width: '45px', height: '45px' }}>
                                                            <Globe className={form.marketingInfo.applicationType === 'Web Traffic' ? 'text-white' : 'text-secondary'} size={22} />
                                                        </div>
                                                        <h6 className="fw-bold mb-1 small">Web Traffic</h6>
                                                        <p className="text-muted mb-0" style={{ fontSize: '0.75rem' }}>Online leads, landing pages, display ads</p>
                                                        {form.marketingInfo.applicationType === 'Web Traffic' && (
                                                            <div className="mt-2">
                                                                <span className="badge bg-danger p-2 fs-7 d-inline-flex align-items-center gap-1">
                                                                    <Check size={12} />
                                                                    Selected
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-md-4">
                                                <div
                                                    onClick={() => handleChange('marketingInfo', 'applicationType', 'Call Traffic')}
                                                    className={`card h-100 border-2 cursor-pointer transition-all ${form.marketingInfo.applicationType === 'Call Traffic'
                                                        ? 'border-danger shadow-lg bg-danger bg-opacity-10'
                                                        : 'border-secondary hover:border-danger hover:shadow'
                                                        }`}
                                                    style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                                                >
                                                    <div className="card-body text-center p-3">
                                                        <div className={`rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center ${form.marketingInfo.applicationType === 'Call Traffic' ? 'bg-danger' : 'bg-secondary bg-opacity-25'
                                                            }`} style={{ width: '45px', height: '45px' }}>
                                                            <Phone className={form.marketingInfo.applicationType === 'Call Traffic' ? 'text-white' : 'text-secondary'} size={22} />
                                                        </div>
                                                        <h6 className="fw-bold mb-1 small">Call Traffic</h6>
                                                        <p className="text-muted mb-0" style={{ fontSize: '0.75rem' }}>Inbound calls, IVR, call centers</p>
                                                        {form.marketingInfo.applicationType === 'Call Traffic' && (
                                                            <div className="mt-2">
                                                                <span className="badge bg-danger p-2 fs-7 d-inline-flex align-items-center gap-1">
                                                                    <Check size={12} />
                                                                    Selected
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-md-4">
                                                <div
                                                    onClick={() => handleChange('marketingInfo', 'applicationType', 'Both')}
                                                    className={`card h-100 border-2 cursor-pointer transition-all ${form.marketingInfo.applicationType === 'Both'
                                                        ? 'border-danger shadow-lg bg-danger bg-opacity-10'
                                                        : 'border-secondary hover:border-danger hover:shadow'
                                                        }`}
                                                    style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                                                >
                                                    <div className="card-body text-center p-3">
                                                        <div className={`rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center ${form.marketingInfo.applicationType === 'Both' ? 'bg-danger' : 'bg-secondary bg-opacity-25'
                                                            }`} style={{ width: '45px', height: '45px' }}>
                                                            <Layers className={form.marketingInfo.applicationType === 'Both' ? 'text-white' : 'text-secondary'} size={22} />
                                                        </div>
                                                        <h6 className="fw-bold mb-1 small">Both</h6>
                                                        <p className="text-muted mb-0" style={{ fontSize: '0.75rem' }}>All types of promotional traffic</p>
                                                        {form.marketingInfo.applicationType === 'Both' && (
                                                            <div className="mt-2">
                                                                <span className="badge bg-danger p-2 fs-7 d-inline-flex align-items-center gap-1">
                                                                    <Check size={12} />
                                                                    Selected
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {errors['marketingInfo.applicationType'] && (
                                            <div className="text-danger text-center mt-2 small">{errors['marketingInfo.applicationType']}</div>
                                        )}
                                    </div>

                                    <hr className="my-4" />


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
                                        <label className="form-label small text-muted">Address Line 2</label>
                                        <input type="text" className={`form-control ${errors['companyInfo.address2'] ? 'is-invalid' : ''}`} placeholder="Enter Apartment, Suite, etc."
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
                                        <select
                                            className={`form-select ${errors['companyInfo.state'] ? 'is-invalid' : ''}`}
                                            required
                                            value={form.companyInfo.state}
                                            onChange={e => handleChange('companyInfo', 'state', e.target.value)}
                                            disabled={!availableStates.length}
                                        >
                                            <option value="">{availableStates.length ? "Select State" : "No States Available / Select Country First"}</option>
                                            {availableStates.map((state) => (
                                                <option key={state.isoCode} value={state.isoCode}>{state.name}</option>
                                            ))}
                                        </select>
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
                                                {Country.getAllCountries().map((country) => (
                                                    <option key={country.isoCode} value={country.isoCode}>{country.name}</option>
                                                ))}
                                            </select>
                                            <div className="invalid-feedback">{errors['companyInfo.country']}</div>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Corporate Website</label>
                                        <input type="text" className={`form-control ${errors['companyInfo.corporateWebsite'] ? 'is-invalid' : ''}`} placeholder="Enter Corporate Website (e.g., https://example.com)"
                                            value={form.companyInfo.corporateWebsite} onChange={e => handleChange('companyInfo', 'corporateWebsite', e.target.value)} />
                                        <div className="invalid-feedback">{errors['companyInfo.corporateWebsite']}</div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Who Referred You? <span className="text-danger">*</span></label>
                                        <select
                                            className={`form-select ${errors['companyInfo.referral'] ? 'is-invalid' : ''}`}
                                            required
                                            disabled={!form.marketingInfo.applicationType}
                                            value={form.companyInfo.referral_id || (form.companyInfo.referral === "Other" ? "Other" : "")}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === "Other") {
                                                    handleChange('companyInfo', 'referral', "Other");
                                                    handleChange('companyInfo', 'referral_id', "");
                                                } else {
                                                    const selectedReferral = referrals.find(r => r.id === val);
                                                    handleChange('companyInfo', 'referral_id', val);
                                                    handleChange('companyInfo', 'referral', selectedReferral ? selectedReferral.name : "");
                                                }
                                            }}
                                        >
                                            <option value="">
                                                {!form.marketingInfo.applicationType
                                                    ? "Please select Application Type first"
                                                    : "Select Referral"}
                                            </option>
                                            {referrals.map((ref, index) => (
                                                <option key={index} value={ref.id}>{ref.name}</option>
                                            ))}
                                            <option value="Other">Other</option>
                                        </select>
                                        {!form.marketingInfo.applicationType && (
                                            <div className="text-warning small mt-1">⚠️ Please select Application Type above to see available referrals</div>
                                        )}
                                        <div className="invalid-feedback">{errors['companyInfo.referral']}</div>
                                    </div>

                                    <h5 className="section-title border-bottom pb-2 mb-3 mt-4">Marketing Information</h5>

                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Payment Model</label>
                                        <select className="form-select" value={form.marketingInfo.paymentModel} onChange={e => handleChange('marketingInfo', 'paymentModel', e.target.value)}>
                                            {Object.entries(PAYMENT_MODELS).map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Primary Category</label>
                                        <select className="form-select" value={form.marketingInfo.primaryCategory} onChange={e => handleChange('marketingInfo', 'primaryCategory', e.target.value)}>
                                            {Object.entries(CATEGORIES).map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Secondary Category</label>
                                        <select className="form-select" value={form.marketingInfo.secondaryCategory} onChange={e => handleChange('marketingInfo', 'secondaryCategory', e.target.value)}>
                                            {Object.entries(CATEGORIES).map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Comments</label>
                                        <textarea className="form-control" rows={3} placeholder="Enter Comments"
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
                                        <div className={errors['accountInfo.workPhone'] ? 'is-invalid-phone' : ''}>
                                            <PhoneInput
                                                placeholder="Enter Work Phone"
                                                value={form.accountInfo.workPhone}
                                                onChange={(value) => handleChange('accountInfo', 'workPhone', value)}
                                                defaultCountry="US"
                                                className={`form-control d-flex ${errors['accountInfo.workPhone'] ? 'is-invalid' : ''}`}
                                            />
                                        </div>
                                        {errors['accountInfo.workPhone'] && <div className="text-danger small mt-1">{errors['accountInfo.workPhone']}</div>}
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Cell Phone</label>
                                        <div className={errors['accountInfo.cellPhone'] ? 'is-invalid-phone' : ''}>
                                            <PhoneInput
                                                placeholder="Enter Cell Phone"
                                                value={form.accountInfo.cellPhone}
                                                onChange={(value) => handleChange('accountInfo', 'cellPhone', value)}
                                                defaultCountry="US"
                                                className={`form-control d-flex ${errors['accountInfo.cellPhone'] ? 'is-invalid' : ''}`}
                                            />
                                        </div>
                                        {errors['accountInfo.cellPhone'] && <div className="text-danger small mt-1">{errors['accountInfo.cellPhone']}</div>}
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
                                            {Object.entries(TIMEZONES).map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="mb-3">

                                        <div className="mb-3">
                                            <label className="form-label small text-muted">IM Services <span className="text-danger">*</span></label>
                                            <div className="card p-3 bg-light border-0">
                                                {Object.entries(IM_SERVICES).map(([key, label]) => (
                                                    <div key={key} className="row mb-2 align-items-center">
                                                        <div className="col-md-3">
                                                            <div className="form-check">
                                                                <input
                                                                    className="form-check-input"
                                                                    type="radio"
                                                                    name="primaryIm"
                                                                    id={`primary-${key}`}
                                                                    checked={primaryIm === key}
                                                                    onChange={() => setPrimaryIm(key)}
                                                                />
                                                                <label className="form-check-label small fw-bold" htmlFor={`primary-${key}`}>
                                                                    {label}
                                                                </label>
                                                            </div>
                                                        </div>
                                                        <div className="col-md-9">
                                                            <input
                                                                type="text"
                                                                className={`form-control form-control-sm ${primaryIm === key && errors['accountInfo.imHandle'] ? 'is-invalid' : ''}`}
                                                                placeholder={`Enter ${label} Handle`}
                                                                value={imHandles[key]}
                                                                onChange={e => handleImChange(key, e.target.value)}
                                                                required={primaryIm === key}
                                                                maxLength={30}
                                                            />
                                                            {primaryIm === key && errors['accountInfo.imHandle'] && (
                                                                <div className="invalid-feedback">{errors['accountInfo.imHandle']}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className="form-text small text-muted mt-1">
                                                    Select the radio button for your <strong>Primary</strong> contact method.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <br />




                                    {/* Payment Information */}
                                    <h5 className="section-title border-bottom pb-2 mb-3 mt-4">Payment Information</h5>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Payment To <span className="text-danger">*</span></label>
                                        <select className={`form-select ${errors['paymentInfo.payTo'] ? 'is-invalid' : ''}`} required value={form.paymentInfo.payTo} onChange={e => handleChange('paymentInfo', 'payTo', e.target.value)}>
                                            {Object.entries(PAYMENT_TO).map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                        <div className="invalid-feedback">{errors['paymentInfo.payTo']}</div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Currency <span className="text-danger">*</span></label>
                                        <select className={`form-select ${errors['paymentInfo.currency'] ? 'is-invalid' : ''}`} required value={form.paymentInfo.currency} onChange={e => handleChange('paymentInfo', 'currency', e.target.value)}>
                                            {Object.entries(CURRENCIES).map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                        <div className="invalid-feedback">{errors['paymentInfo.currency']}</div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small text-muted">Tax Class <span className="text-danger">*</span></label>
                                        <select className={`form-select ${errors['paymentInfo.taxClass'] ? 'is-invalid' : ''}`} required value={form.paymentInfo.taxClass} onChange={e => handleChange('paymentInfo', 'taxClass', e.target.value)}>
                                            {Object.entries(TAX_CLASSES).map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
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
                                            sitekey={process.env.NEXT_PUBLIC_APP_RECAPTCHA_SITE_KEY!}
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
                </div>
            </div>
        </>
    );
}


