const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


module.exports = {
  async getLogin(req, res) {
    res.render('manager/login');
  },
  async managerLogin(req, res) {
    try {
      const { email, password } = req.body;
  
      
      // Fetch the drop point associated with the manager's email
      const dropPoint = await prisma.dropPoint.findFirst({
        where: {
          manager: {
            email: email
          }
        }
      }); 
  
      // If the manager has no associated drop point or the password doesn't match, render the login page with an error
      if (!dropPoint || dropPoint.password !== password) {
        return res.render('manager/login', { error: "Invalid credentials." });
      }

      // Store manager's ID in session for future requests
      req.session.managerId = dropPoint.managerId;
  
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
  
      // Check if managerWithDropPoint or managerWithDropPoint.dropPoint is null
      if (!managerWithDropPoint || !managerWithDropPoint.dropPoint) {
        return res.status(404).send("Manager or associated drop point not found");
      }
  
      // Extract the drop point name or provide a default value if it's not available  
      const dropPointName = managerWithDropPoint.dropPoint[0]?.name || "Unnamed Drop Point";

  
      // Render the dashboard with the manager's profile and drop point name
      res.render('manager/dashboard', { manager: managerWithDropPoint, dropPointName });
  
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
                include: { 
                  organization: true,
                  peripherals: true
                }  // Fetch related organization for each donation
              }
            }
          }
        }
      });
  
      // Get the drop point name from the first drop point (if it exists)
      const dropPointName = managerWithDropPoint.dropPoint[0]?.name || "Unnamed Drop Point";
  
      // Render the manageDonation view, passing in the donations and dropPoint name
      res.render('manager/manageDonation', { 
        donations: managerWithDropPoint.dropPoint[0]?.donations || [],
        dropPointName: dropPointName,
      });
  
    } catch (error) {
      console.error("Error fetching donations:", error);
      res.status(500).send("Internal Server Error");
    }
  }, 
  async updateDonationStatus(req, res) {
    try {
      const { donationId, newStatus } = req.body;
  
      // Update the donation status using donationId and newStatus
      await prisma.donation.update({
        where: { id: donationId },
        data: { status: newStatus },
      });
  
      // Redirect back to the donations management page
      res.redirect('/manager/manageDonation');
    } catch (error) {
      console.error("Error updating donation status:", error);
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
      
      // Get the drop point name from the first drop point (if it exists)
      const dropPointName = managerWithDropPoint.dropPoint[0]?.name || "Unnamed Drop Point";

  
      // Render the manager account page with the manager's profile and drop point name
      res.render('manager/manageraccount', { manager: managerWithDropPoint, dropPointName: dropPointName });
  
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
   
