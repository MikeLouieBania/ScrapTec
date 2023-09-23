const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


module.exports = {
  async getLogin(req, res) {
    res.render('manager/login');
  },
  async managerLogin(req, res) {
    try {
      const { email, password } = req.body;
  
      // Fetch the manager based on the email to get its ID
      const manager = await prisma.manager.findUnique({
        where: {
          email: email
        }
      });
  
      // If no manager is found with that email, render the login page with an error
      if (!manager) {
        return res.render('manager/login', { error: "Invalid credentials." });
      }
  
      // Fetch the drop point associated with this manager
      const dropPoint = await prisma.dropPoint.findUnique({
        where: {
          managerId: manager.id
        }
      });
  
      // If the manager has no associated drop point or the password doesn't match, render the login page with an error
      if (!dropPoint || dropPoint.password !== password) {
        return res.render('manager/login', { error: "Invalid credentials." });
      }

      // Store manager's ID in session for future requests
      req.session.managerId = manager.id;
  
      // Successful login, redirect to the dashboard.
      res.redirect('/manager/dashboard');
    } catch (error) {
      console.error("Error during manager login:", error);
      res.render('manager/login', { error: "Internal Server Error." });
    }
  },
  async getDashboard(req, res) {
    try {
      // Fetch the manager's profile and associated drop point using the ID stored in the session
      const managerWithDropPoint = await prisma.manager.findUnique({
        where: {
          id: req.session.managerId
        },
        include: {
          dropPoint: true  // Fetch associated drop point details
        }
      });
  
      // Render the dashboard with the manager's profile and drop point name
      res.render('manager/dashboard', { manager: managerWithDropPoint, dropPointName: managerWithDropPoint.dropPoint?.name });
  
    } catch (error) {
      console.error("Error fetching manager's profile:", error);
      res.status(500).send("Internal Server Error");
    }
  },
  async getManageDonation(req, res) {
    try {
        // Fetch the manager's profile and associated drop point using the ID stored in the session
        const managerWithDropPoint = await prisma.manager.findUnique({
          where: {
            id: req.session.managerId
          },
          include: {
            dropPoint: {
              include: {
                donations: {
                  where: { isSubmitted: true },  // Fetch only the submitted donations
                  include: { organization: true }  // Fetch related organization for each donation
                }
              }
            }
          }
        }); 
        
        // Format the Expected Date of Arrival for each donation
        managerWithDropPoint.dropPoint.donations.forEach(donation => {
          if (donation.expectedDateOfArrival) {
              const dateObj = new Date(donation.expectedDateOfArrival);
              donation.formattedDateOfArrival = `${dateObj.getDate()} ${dateObj.toLocaleString('default', { month: 'long' })} ${dateObj.getFullYear()}`;
          }
      });

        // Render the manageDonation view, passing in the donations and dropPoint name
        res.render('manager/manageDonation', { 
          donations: managerWithDropPoint.dropPoint.donations,
          dropPointName: managerWithDropPoint.dropPoint.name,  
      });

    } catch (error) {
        console.error("Error fetching donations:", error);
        res.status(500).send("Internal Server Error");
    }
  },
  async getManagerAccount(req, res) {
    try {
      // Fetch the manager's profile and associated drop point using the ID stored in the session
      const managerWithDropPoint = await prisma.manager.findUnique({
        where: {
          id: req.session.managerId
        },
        include: {
          dropPoint: true  // Fetch associated drop point details
        }
      });
  
      // Render the manager account page with the manager's profile and drop point name
      res.render('manager/manageraccount', { manager: managerWithDropPoint, dropPointName: managerWithDropPoint.dropPoint?.name });
  
    } catch (error) {
      console.error("Error fetching manager's profile:", error);
      res.status(500).send("Internal Server Error");
    }
  }, 
  managerLogout(req, res) {
    req.session.managerId = null; // Clear the manager's session
    res.redirect('/manager/login');
  }
};
   
