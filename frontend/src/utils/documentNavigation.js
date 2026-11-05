// Enter the system with a real document navigation after saving the session.
// The browser handles its own page-loading indicator during this request.
export const loadSystemPage = path => window.location.replace(path);
