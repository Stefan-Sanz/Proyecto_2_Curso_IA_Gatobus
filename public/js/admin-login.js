const loginForm = document.querySelector("#formulario-login-admin");
const loginResult = document.querySelector("#resultado-login-admin");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  loginResult.className = "resultado";
  loginResult.textContent = "Validando acceso...";

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: loginForm.elements.username.value,
        password: loginForm.elements.password.value
      })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "No fue posible iniciar sesión.");
    }

    window.location.assign("/admin.html");
  } catch (error) {
    loginResult.className = "resultado error";
    loginResult.textContent = error.message;
    button.disabled = false;
  }
});
