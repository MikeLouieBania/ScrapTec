require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
<<<<<<< Updated upstream
const prisma = new PrismaClient();
=======
const prisma = new PrismaClient(); 
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

function isPDF(filename) {
  return filename.toLowerCase().endsWith('.pdf');
} 
function isDOCX(filename) {
  return filename.toLowerCase().endsWith('.docx');
} 
>>>>>>> Stashed changes

module.exports = {
  async getAdminLogin(req, res) {
    res.render('admin/login');
  }, 
<<<<<<< Updated upstream
=======
  async postAdminLogin(req, res) {
    try {
      const { email, password } = req.body;

      // Run both queries concurrently
      const [admin] = await Promise.all([
          prisma.admin.findUnique({
              where: { email },
              select: {
                  id: true,
                  email: true,
                  password: true,
                  //...other fields you need
              }
          })
        ]);

      if (!admin) {
          return res.render('admin/login', { message: 'Invalid email or password.' });
      }

      if (admin) {
          // User login
          const passwordMatch = await bcrypt.compare(password, admin.password);

          if (!passwordMatch) {
              return res.render('admin/login', { message: 'Password Incorrect.' });
          }

          // Set user session after successful login
          req.session.adminId = admin;

          // Redirect to the user dashboard
          return res.redirect('/admin/dashboard');
      }
  } catch (error) {
      console.error(error);
      res.render('admin/login',{ message: 'An error occurred' });
  }
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

        // Fetch the organization's details
        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });
  
        // Update the organization's status
        await prisma.organization.update({
            where: { id: organizationId },
            data: { verificationStatus: newStatus }
        });

        // Create email transporter
        const transporter = nodemailer.createTransport({
          service: process.env.EMAIL_SERVICE,
          auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD,
          },
        });

        // Set up different email content based on the new status
        let subject, htmlContent;

        if (newStatus === 'APPROVED') {
          subject = 'Your Organization Has Been Approved';
          htmlContent = `
            <h1>Congratulations!</h1>
            <p>Your organization, "${organization.organizationname}", has been approved.</p>
            <p>Best regards,</p>
            <p>Your Team</p>
          `;
        } else if (newStatus === 'REJECTED') {
          subject = 'Your Organization Application Was Not Approved';
          htmlContent = `
            <h1>Application Not Approved</h1>
            <p>Unfortunately, your organization, "${organization.organizationname}", has not been approved.</p>
            <p>If you have questions, please reach out to our support team.</p>
            <p>Best regards,</p>
            <p>Your Team</p>
          `;
        } else {
          // Handle other statuses if needed
        }

        // Only send the email if subject and htmlContent are set
        if (subject && htmlContent) {
          const mailOptions = {
            from: process.env.EMAIL_USERNAME,
            to: organization.email,
            subject: subject,
            html: `<div style="font-family: Arial, sans-serif; border: 1px solid #ccc; padding: 20px; margin: 10px;">${htmlContent}</div>`
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error("Email could not be sent:", error);
            } else {
              console.log("Email sent:", info.response);
            }
          });
        }
  
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
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
};
=======

  async getAccount(req, res) { 
    const admin = await prisma.admin.findUnique({
      where: {id: req.session.adminId.id},
    });
    res.render('admin/dashboard', { admin }); 
  },  

  adminLogout(req, res) {
    // Clear the session to log out the user
    req.session.adminId = null;
    res.redirect('/admin/login');
  },
};
>>>>>>> Stashed changes
