module.exports = {
    requireLogin: (req, res, next) => {
      if (!req.session.adminId) {
        return res.render('admin/login', { message : 'You are not logged in.'}); // Redirect to login page if manager is not logged in
      }
      next(); // Proceed to the next middleware/route handler
    },
    checkLoggedInRedirect: (req, res, next) => {
      if (req.session.adminId) {
        return res.redirect('/admin/dashboard'); // Redirect logged-in managers to the dashboard
      }
      next(); // Proceed to the next middleware/route handler
    },
};