module.exports = {
    requireLogin: (req, res, next) => {
      if (!req.session.organization) {
        return res.render('login', { message : 'You are not logged in.'}); // Redirect to login page if organization is not logged in
      }
      next(); // Proceed to the next middleware/route handler
    },
    checkLoggedInRedirect: (req, res, next) => {
      if (req.session.organization) {
        return res.redirect('/organization/dashboard'); // Redirect logged-in organization to the dashboard
      }
      next(); // Proceed to the next middleware/route handler
    },
};
