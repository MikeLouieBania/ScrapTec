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
      const validStatuses = ["PENDING", "APPROVED", "REJECTED"];
  
      // Get the status from the session or default to "PENDING"
      const selectedStatus = req.session.status && validStatuses.includes(req.session.status) 
                             ? req.session.status 
                             : "PENDING";
  
      // Delete the status from the session
      delete req.session.status;
  
      // Fetch ALL organizations
      const organizations = await prisma.organization.findMany();
  
      res.render('admin/organizationmanagement', { organizations, selectedStatus });
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).send("Internal Server Error");
    }
  },
  
  async updateOrganizationStatus(req, res) {
    try {
        const { organizationId, newStatus } = req.body;
  
        if (!organizationId || !newStatus) {
            return res.status(400).send("Missing required parameters.");
        }
  
        await prisma.organization.update({
            where: { id: organizationId },
            data: { verificationStatus: newStatus }
        });
  
        // Store the newStatus in the session
        req.session.status = newStatus;
  
        // Redirect back to the organization management page without the query parameter
        res.redirect('/admin/organizationmanagement');
  
    } catch (error) {
        console.error("Error updating organization status:", error);
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
      // Fetch all managers
      const managers = await prisma.manager.findMany();
      // Fetch all drop points
      const dropPoints = await prisma.dropPoint.findMany({
        include: {
          manager: true,  // Include manager details
        },
      });
  
      // Render the management page
      res.render('admin/droppointmanagement', { managers, dropPoints });
    } catch (error) {
      console.error("Error fetching drop points:", error);
      res.status(500).send("Internal Server Error");
    }
  },
  
  async getManagerManagement(req, res) {
    try {
      // Fetch managers
      const managers = await prisma.manager.findMany();
  
      // Fetch unique assigned managerIds from drop points
      const dropPoints = await prisma.dropPoint.groupBy({
        by: ['managerId'],
        where: {
          managerId: {
            not: {
              equals: null
            }
          }
        },
        _count: true
      });
  
      const assignedManagerIds = new Set(dropPoints.map(dp => dp.managerId));
  
      // Add assignment status to managers
      const managersWithStatus = managers.map(manager => ({
        ...manager,
        isAssigned: assignedManagerIds.has(manager.id)
      }));
  
      res.render('admin/managermanagement', { managers: managersWithStatus });
    } catch (error) {
      console.error("Error fetching managers:", error);
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
  async removeManagerFromDropPoint(req, res) {
    try {
      const { dropPointId } = req.body;
  
      if (!dropPointId) {
        return res.status(400).send('dropPointId is missing or invalid.');
      }
  
      // Update the DropPoint to remove the manager's ID
      await prisma.dropPoint.update({
        where: { id: dropPointId },
        data: {
          managerId: null,
          password: null  // Optional: Reset the password if needed
        }
      });
  
      // Redirect back to the management page
      res.redirect('/admin/droppointmanagement');
    } catch (error) {
      console.error("Error removing manager from drop point:", error);
      res.status(500).send("Internal Server Error");
    }
  },
   
};
