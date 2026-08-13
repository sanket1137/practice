import { jwtDecode } from 'jwt-decode';

/**
 * Returns true when the given JWT is absent, undecodable, or past its `exp` claim.
 * A token without an `exp` claim is treated as non-expired (server-side policy decides).
 */
export function isTokenExpired(token: string | null | undefined): boolean {
    if (!token) return true;
    try {
        const { exp } = jwtDecode(token);
        if (typeof exp !== 'number') return false;
        return exp * 1000 <= Date.now();
    } catch {
        // Undecodable token — treat as expired/invalid
        return true;
    }
}

