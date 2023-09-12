module.exports = {
    requireLogin: (req, res, next) => {
      if (!req.session.user) {
        return res.redirect('/login'); // Redirect to login page if user is not logged in
      }
      next(); // Proceed to the next middleware/route handler
    },
    checkLoggedInRedirect: (req, res, next) => {
      if (req.session.user) {
        return res.redirect('/user/dashboard'); // Redirect logged-in users to the dashboard
      }
      next(); // Proceed to the next middleware/route handler
    },
  };
  