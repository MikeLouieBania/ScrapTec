const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); 
const nodemailer = require("nodemailer");

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
      const allManagers = await prisma.manager.findMany();
    
      // Fetch all drop points
      const dropPoints = await prisma.dropPoint.findMany({
        include: {
          manager: true,  // Include manager details
        },
      });
    
      // Filter out managers who are already assigned to a drop point
      const unassignedManagers = allManagers.filter(manager => {
        return !dropPoints.some(dropPoint => dropPoint.managerId === manager.id);
      });
    
      // Render the management page, sending only the unassigned managers
      res.render('admin/droppointmanagement', { managers: unassignedManagers, dropPoints });
    
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
      const existingDropPoint = await prisma.dropPoint.findFirst({
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
      

      // Fetch the updated drop point details
      const updatedDropPoint = await prisma.dropPoint.findUnique({
        where: { id: dropPointId },
      });

      // Send email to the manager with details
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USERNAME,
        to: manager.email,
        subject: 'Assignment to Drop Point',
        html: `
          <div style="font-family: Arial, sans-serif; border: 1px solid #ccc; padding: 20px; margin: 10px;">
            <h1 style="color: #333366;">You've Been Assigned to a Drop Point</h1>
            <p>Dear ${manager.firstName} ${manager.lastName},</p>
            <p>We are pleased to inform you that you have been assigned to the following drop point:</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="border: 1px solid #ccc; padding: 8px; text-align: left;">Name</td>
                <td style="border: 1px solid #ccc; padding: 8px; text-align: left;">${updatedDropPoint.name}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ccc; padding: 8px; text-align: left;">Location</td>
                <td style="border: 1px solid #ccc; padding: 8px; text-align: left;">${updatedDropPoint.location}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ccc; padding: 8px; text-align: left;">Operating Hours</td>
                <td style="border: 1px solid #ccc; padding: 8px; text-align: left;">${updatedDropPoint.openingTime} - ${updatedDropPoint.closingTime}</td>
              </tr>
            </table>
            <p>Your access password is: <strong>${updatedDropPoint.password}</strong></p>
            <p>Please reach out to our support team for any further assistance.</p>
            <p>Best regards,</p>
            <p>Your Team</p>
          </div>
        `,
      };
      

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Email could not be sent:", error);
        } else {
          console.log("Email sent:", info.response);
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
  async updateDropPoint(req, res) {
    try {
      const { id, name, location, openingTime, closingTime, description } = req.body;
  
      // Ensure all required fields are provided
      if (!id || !name || !location || !openingTime || !closingTime || !description) {
        return res.status(400).send("Missing required parameters.");
      }
  
      // Update the DropPoint
      await prisma.dropPoint.update({
        where: { id },
        data: {
          name,
          location,  // You might choose to omit this since it's readonly in your form
          openingTime,
          closingTime,
          description,
        },
      });
  
      res.redirect('/admin/droppointmanagement');
    } catch (error) {
      console.error("Error while updating drop point:", error);
      res.status(500).send("Internal Server Error");
    }
  },
};
