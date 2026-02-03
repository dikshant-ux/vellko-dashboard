
import "bootstrap/dist/css/bootstrap.min.css";

export default function AffiliateSignupLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="bootstrap-scope">
            {children}
        </div>
    );
}
