import NextAuth, { CredentialsSignin } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

class CustomAuthError extends CredentialsSignin {
    constructor(message: string) {
        super(message);
        this.code = message;
    }
}

class DeactivatedError extends CredentialsSignin {
    code = "account_deactivated"
}

class InvalidCredentialsError extends CredentialsSignin {
    code = "invalid_credentials"
}

class MFARequiredError extends CredentialsSignin {
    code = "mfa_required"
}

export const {
    handlers: { GET, POST },
    auth,
    signIn,
    signOut,
} = NextAuth({
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
                remember: { label: "Remember Me", type: "checkbox" },
                otp: { label: "OTP", type: "text" }
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) return null;

                try {
                    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;
                    const res = await fetch(`${apiUrl}/token`, {
                        method: "POST",
                        body: new URLSearchParams({
                            username: credentials.username as string,
                            password: credentials.password as string,
                            remember: String(credentials.remember || false),
                            otp: (credentials.otp as string) || "",
                        }),
                        headers: { "Content-Type": "application/x-www-form-urlencoded" }
                    });


                    if (res.ok) {
                        const user = await res.json();
                        if (user.access_token) {
                            const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;
                            const meRes = await fetch(`${apiUrl}/users/me`, {
                                headers: { Authorization: `Bearer ${user.access_token}` }
                            });

                            if (meRes.ok) {
                                const me = await meRes.json();
                                return {
                                    name: me.username,
                                    email: me.email,
                                    role: me.role,
                                    accessToken: user.access_token,
                                } as any;
                            }
                        }
                        return null;
                    } else {
                        // Handle errors from backend
                        const err = await res.json();
                        const detail = err.detail || "";

                        // Map backend errors to codes
                        if (detail.includes("deactivated")) {
                            throw new DeactivatedError();
                        } else if (detail.includes("Incorrect username")) {
                            throw new InvalidCredentialsError();
                        } else if (detail === "mfa_required") {
                            throw new MFARequiredError();
                        } else {
                            // Fallback for other errors
                            throw new InvalidCredentialsError();
                        }
                    }

                } catch (e: any) {
                    if (e instanceof CredentialsSignin) {
                        throw e;
                    }
                    console.error("Auth error:", e);
                    throw new InvalidCredentialsError();
                }
            }
        })
    ],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async jwt({ token, user }: any) {
            if (user) {
                token.accessToken = user.accessToken;
                token.role = user.role;
            }
            return token;
        },
        async session({ session, token }: any) {
            session.accessToken = token.accessToken;
            session.user.role = token.role;
            return session;
        }
    }
});
