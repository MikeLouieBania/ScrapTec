const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); 

module.exports = {
  async getDashboard(req, res) { 
    try { 
        res.render('organization/dashboard');
    } catch(error) {
        console.error("Error fetching drop points:", error);
        res.status(500).send("Internal Server Error");
    }
  },
     
  logout(req, res) {
    // Clear the session to log out the user
    req.session.organization = null;
    res.redirect('/');
  },
};
