(() => {
  const adminAccessKey = "entryfrag-admin-access";
  const logoutButton = document.getElementById("adminLogoutPage");

  const clearAdminAccess = () => {
    try {
      sessionStorage.removeItem(adminAccessKey);
    } catch {}
  };

  const redirectHome = () => {
    window.location.replace("./index.html");
  };

  let isAllowed = false;
  try {
    isAllowed = sessionStorage.getItem(adminAccessKey) === "granted";
  } catch {}

  if (!isAllowed) {
    redirectHome();
    return;
  }

  logoutButton?.addEventListener("click", () => {
    clearAdminAccess();
    redirectHome();
  });

  window.addEventListener("pageshow", () => {
    let stillAllowed = false;
    try {
      stillAllowed = sessionStorage.getItem(adminAccessKey) === "granted";
    } catch {}
    if (!stillAllowed) redirectHome();
  });
})();
