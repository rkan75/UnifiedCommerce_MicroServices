package com.tcs.commerce.dashboard.filter;

import com.tcs.commerce.dashboard.config.DashboardProperties;
import com.tcs.commerce.dashboard.security.JwtValidator;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

/**
 * Requires valid JWT (cookie or Authorization header) for /app and /admin paths, except login and auth endpoints.
 */
public class AuthFilter extends OncePerRequestFilter {

    private final DashboardProperties props;
    private final JwtValidator jwtValidator;

    public AuthFilter(DashboardProperties props, JwtValidator jwtValidator) {
        this.props = props;
        this.jwtValidator = jwtValidator;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (path == null) path = "";
        String normalized = path.replaceAll("/+$", "");
        if (normalized.isEmpty()) normalized = "/";

        if (isPublicPath(normalized)) {
            filterChain.doFilter(request, response);
            return;
        }

        if (!normalized.startsWith("/app") && !normalized.startsWith("/admin")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = getToken(request);
        Optional<JwtValidator.SessionPayload> auth = token != null ? jwtValidator.validate(token) : Optional.empty();
        if (auth.isEmpty()) {
            if (isJsonRequest(request)) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.getWriter().write("{\"message\":\"Unauthorized\"}");
                return;
            }
            response.sendRedirect("/admin-login");
            return;
        }
        request.setAttribute("auth", auth.get());
        filterChain.doFilter(request, response);
    }

    private boolean isPublicPath(String path) {
        return path.equals("/admin-login") || path.equals("/admin-login.html")
            || path.startsWith("/auth/")
            || path.equals("/admin/logo")
            || path.startsWith("/static/") || path.startsWith("/css/") || path.startsWith("/js/")
            || path.equals("/health") || path.equals("/actuator") || path.startsWith("/actuator/")
            || path.equals("/favicon.ico") || path.equals("/logo.png");
    }

    private boolean isJsonRequest(HttpServletRequest request) {
        String accept = request.getHeader("Accept");
        return accept != null && accept.contains(MediaType.APPLICATION_JSON_VALUE);
    }

    private String getToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if (props.getCookieName().equals(c.getName())) return c.getValue();
            }
        }
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) return auth.substring(7).trim();
        return null;
    }
}
