import NextAuth from "next-auth"

declare module "next-auth" {
    interface Session {
        accessToken?: string
        user: {
            application_permission: string
            name?: string | null
            email?: string | null
            image?: string | null
            role?: string
            can_approve_signups?: boolean
            can_view_reports?: boolean
        }
    }
}
