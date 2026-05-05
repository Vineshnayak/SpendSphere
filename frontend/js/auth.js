document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");

    // Redirect to dashboard if already logged in
    if (localStorage.getItem("token") && (loginForm || signupForm)) {
        window.location.href = "dashboard.html";
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = document.getElementById("loginBtn");
            const user = document.getElementById("username").value.trim();
            const pass = document.getElementById("password").value;

            btn.disabled = true;
            btn.innerText = "Logging in...";

            try {
                const res = await fetch(`${API_URL}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: user, password: pass })
                });

                const data = await res.json();

                if (res.ok) {
                    localStorage.setItem("token", data.access_token);
                    localStorage.setItem("username", user);
                    window.location.href = "dashboard.html";
                } else {
                    showToast(data.detail || "Login failed", "error");
                }
            } catch (err) {
                showToast("Cannot connect to server.", "error");
            } finally {
                btn.disabled = false;
                btn.innerText = "Login";
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = document.getElementById("signupBtn");
            const user = document.getElementById("regUsername").value.trim();
            const pass = document.getElementById("regPassword").value;

            btn.disabled = true;
            btn.innerText = "Creating account...";

            try {
                const res = await fetch(`${API_URL}/signup`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: user, password: pass })
                });

                const data = await res.json();

                if (res.ok) {
                    showToast("Account created successfully! Please login.", "success");
                    setTimeout(() => window.location.href = "login.html", 2000);
                } else {
                    // This handles our unique username validation!
                    showToast(data.detail || "Signup failed", "error");
                }
            } catch (err) {
                showToast("Cannot connect to server.", "error");
            } finally {
                btn.disabled = false;
                btn.innerText = "Sign Up";
            }
        });
    }
});

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "login.html";
}
