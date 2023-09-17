const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); 

function isPDF(filename) {
  return filename.toLowerCase().endsWith('.pdf');
}

function isDOCX(filename) {
  return filename.toLowerCase().endsWith('.docx');
}


module.exports = {
  async getDashboard(req, res) {
    res.render('admin/dashboard');
  }, 
  async getOrganizationManagement(req, res) {
    try {
      const { status } = req.query;
      const validStatuses = ["PENDING", "APPROVED", "REJECTED"];
  
      // Check if the status parameter is not valid, default to "pending"
      const selectedStatus = validStatuses.includes(status) ? status : "APPROVED";
  
      // Fetch organizations based on the selected status
      // const organizations = await prisma.organization.findMany({
      //   where: {
      //     verificationStatus: selectedStatus,
      //   },
      // });
      
    // Fetch ALL organizations, not just based on the selected status
    const organizations = await prisma.organization.findMany();
  
      res.render('admin/organizationmanagement', { organizations, selectedStatus });
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).send("Internal Server Error");
    }
  },
  async viewDocuments(req, res) {
    try {
      const { organizationId } = req.query;

      // Fetch the organization by ID to display its name or other information if needed
      const organization = await prisma.organization.findUnique({
        where: {
          id: organizationId,
        },
      });

      if (!organization) {
        // Handle the case where the organization is not found
        res.status(404).send("Organization not found");
        return;
      }

      // Fetch the documents associated with the organization by organizationId
      const documents = await prisma.document.findMany({
        where: {
          organizationId,
        },
      });

      // Pass the organization and documents to the template
      res.render('admin/viewdocuments', { organization, documents, isPDF, isDOCX });
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).send("Internal Server Error");
    }
  },
  
  
  
  async getDropPointManagement(req, res) {
    try {
      const managers = await prisma.manager.findMany();
      const dropPoints = await prisma.dropPoint.findMany();

      res.render('admin/droppointmanagement', { managers, dropPoints });
    } catch (error) {
      console.error("Error fetching drop points:", error);
      res.status(500).send("Internal Server Error");
    }
  },
  async getManagerManagement(req, res) {
    try {
      const managers = await prisma.manager.findMany(); 

      res.render('admin/managermanagement', { managers });
    } catch (error) {
      console.error("Error fetching drop points:", error);
      res.status(500).send("Internal Server Error");
    }
  },
  async getUserManagement(req, res) {
    res.render('admin/usermanagement');
  }, 
  async createDropPoint(req, res) {
    try {
      const { name, location, openingTime, closingTime, description } = req.body;

      // Creating a new DropPoint
      const newDropPoint = await prisma.dropPoint.create({
        data: {
          name,
          location,
          openingTime,
          closingTime,
          description,
        }
      });

      res.redirect('/admin/droppointmanagement');  // Redirect back to drop point management page or wherever you'd like

    } catch (error) {
      console.error("Error while creating drop point:", error);
      res.status(500).send("Internal Server Error");
    }
  },
  async registerManager(req, res) {
    try {
      const { firstName, lastName, email, phoneNumber, address } = req.body;
  
      // Registering a new Manager
      const newManager = await prisma.manager.create({
        data: {
          firstName,
          lastName,
          email,
          phoneNumber,
          address
        }
      });
  
      // Redirecting back might be to a different page, perhaps a manager listing or management page.
      res.redirect('/admin/managermanagement');
    } catch (error) {
      console.error("Error while registering manager:", error);
      res.status(500).send("Internal Server Error");
    }
  }, 
  async assignManagerToDropPoint(req, res) {
    try {
      const { managerEmail, password, dropPointId } = req.body;
  
      // First, fetch the manager based on the email to get its ID
      const manager = await prisma.manager.findUnique({
        where: {
          email: managerEmail
        }
      });
  
      // If no manager is found with that email, return an error
      if (!manager) {
        return res.status(400).send("Manager not found.");
      }
  
      // Check if this manager is already assigned to a drop point (Optional: Depending on your business rules)
      const existingDropPoint = await prisma.dropPoint.findUnique({
        where: {
          managerId: manager.id
        }
      });
  
      if (existingDropPoint) {
        return res.status(400).send("This manager is already assigned to another drop point.");
      }
  
      // Now, update the DropPoint with the manager's ID and the provided password
      await prisma.dropPoint.update({
        where: { id: dropPointId },
        data: {
          managerId: manager.id,
          password: password
        }
      });
  
      // Redirect or send a success response
      res.redirect('/admin/droppointmanagement');
  
    } catch (error) {
      console.error("Error assigning manager to drop point:", error);
      res.status(500).send("Internal Server Error");
    }
  },
  async getDropPointManagement(req, res) {
    try {
      // Fetching managers who aren't assigned to any DropPoint yet
      const availableManagers = await prisma.manager.findMany({
        where: {
          dropPoint: null
        }
      });
      const dropPoints = await prisma.dropPoint.findMany({
        include: {
          manager: true
        }
      });
  
      res.render('admin/droppointmanagement', { managers: availableManagers, dropPoints });
    } catch (error) {
      console.error("Error fetching drop points:", error);
      res.status(500).send("Internal Server Error");
    }
  },
};
