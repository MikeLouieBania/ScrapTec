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
  async getAddDonation(req, res) {
    try {
      // Fetch only the associated drop point for the logged-in manager
      const managerWithDropPoint = await prisma.manager.findUnique({
        where: {
          id: req.session.managerId
        },
        select: {
          dropPoint: true  // Only select associated drop point details
        }
      });

      // Render the add donation page with the drop point name
      res.render('manager/manageradddonation', { dropPointName: managerWithDropPoint.dropPoint?.name });

    } catch (error) {
      console.error("Error fetching manager's drop point:", error);
      res.status(500).send("Internal Server Error");
    }
  }, 
  async saveDonation(req, res) {
    try {
        const { userId, itemName, itemDescription, status, quantity, category, itemPhoto } = req.body;

        // TODO: Validate the inputs if necessary

        // Fetch the drop point ID for the logged-in manager
        const managerWithDropPoint = await prisma.manager.findUnique({
            where: {
                id: req.session.managerId
            },
            select: {
                dropPoint: true  // Only select associated drop point details
            }
        });

        const dropPointId = managerWithDropPoint.dropPoint?.id;

        // Store the donation in the database
        const donation = await prisma.donation.create({
            data: {
                itemName: itemName,
                itemDescription: itemDescription,
                status: status,
                quantity: parseInt(quantity, 10),
                category: category,
                // Assuming itemPhoto is just a string for the filename; adjust accordingly if handling actual files
                itemPhoto: itemPhoto,
                dropPointId: dropPointId,
                userId: userId
            }
        });

        // Redirect to a success page or the dashboard with a success message
        res.redirect('/manager/dashboard');
    } catch (error) {
        console.error("Error saving donation:", error);
        // Redirect to the add donation page with an error message
        res.redirect('/manager/manageradddonation');
    }
  },

  managerLogout(req, res) {
    req.session.managerId = null; // Clear the manager's session
    res.redirect('/manager/login');
  }
};
   