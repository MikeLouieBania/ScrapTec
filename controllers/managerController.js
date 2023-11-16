const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const nodemailer = require('nodemailer');
require('dotenv').config();
async function sendMilestoneCertificate(organization, numberOfDonations) { 
  return new Promise(async (resolve, reject) => {
    try {   
        let certificateDetails = {};
        switch (true) {
          case (numberOfDonations === 1):
            certificateDetails = {
              file: 'Bronze-Level.pdf',
              position: { x: 200, y: 275 },
              size: 50,
              color: rgb(0, 0, 0)
            };
            break;
          case (numberOfDonations === 7):
            certificateDetails = {        
              file: 'Gold-Level.pdf',
              position: { x: 160, y: 260 },
              size: 45 ,
              color: rgb(176, 126, 9)
            };
            break;
            case (numberOfDonations === 10):
              certificateDetails = {
                file: 'Diamond-Level.pdf',
                position: { x: 170, y: 265 },
                size: 40 ,
                color: rgb(107, 77, 33)
              };
              break;
            case (numberOfDonations === 20):
              certificateDetails = {
                file: 'Platinum-Level.pdf',
                position: { x: 180, y: 270 },
                size: 35,
                color: rgb(0, 0, 0)
              };
              break;
            default:
              return reject('No certificate file determined for the given number of donations.');
        } 

        // Define the path to the certificate file based on the milestone
        const pdfPath = path.join(__dirname, '..', 'certificate', certificateDetails.file);
        const pdfBytes = fs.readFileSync(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // Register fontkit instance
        pdfDoc.registerFontkit(fontkit);

        // Load the Caladea font
        const fontBytes = fs.readFileSync(path.join(__dirname, '..', 'fonts', 'Caladea-Regular.ttf'));
        // Embed a font
        const font = await pdfDoc.embedFont(fontBytes);

        // Get the first page of the document
        const pages = pdfDoc.getPages();
        const firstPage = pages[0]; 

        // Add the organization name to the page
        firstPage.drawText(organization.organizationname, {
            x: certificateDetails.position.x,
            y: certificateDetails.position.y,
            size: certificateDetails.size,
            font: font,
            color: certificateDetails.color
        });

        // Save the modified PDF
        const modifiedPdfBytes = await pdfDoc.save();

        // Email configuration
        const transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE,
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        // HTML formatted email content
        const htmlContent = `
            <h1>Congratulations on Your Achievement!</h1>
            <p>Dear ${organization.organizationname},</p>
            <p>We are thrilled to acknowledge your remarkable contribution to our cause. Your dedication and generosity are truly appreciated.</p>
            <p>Attached is your milestone certificate as a token of our gratitude.</p>
            <p>Thank you for your continued support.</p>
            <p>Best regards,</p>
            <p><strong>CycleUpTech</strong></p>
        `;

        // Send the email with the attached certificate
        await transporter.sendMail({
            from: process.env.EMAIL_USERNAME,
            to: organization.email,
            subject: 'Your Milestone Achievement Certificate',
            html: htmlContent,
            attachments: [
                {
                    filename: 'Milestone-Certificate.pdf',
                    content: modifiedPdfBytes,
                },
            ],
        });

        console.log('Milestone certificate sent successfully.');
        return { success: true };
    } catch (error) {
        console.error('Error sending milestone certificate:', error);
        return { success: false, error: error.message };
    }
  });
}

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
        return res.render('manager/login', { message: "Invalid credentials." });
      }

      // Store manager's ID in session for future requests
      req.session.managerId = dropPoint.managerId;
  
      // Successful login, redirect to the dashboard.
      res.redirect('/manager/dashboard');
    } catch (error) {
      console.error("Error during manager login:", error);
      res.render('manager/login', { message: "Internal Server Error." });
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
        return res.render('manager/login', { message: "Manager or associated drop point not found" });
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
  
      // Fetch the existing donation
      const donation = await prisma.donation.findUnique({
        where: { id: donationId },
        select: {
          points: true,
          organizationId: true
        }
      });
  
      // Check if the donation exists and has points.
      if (!donation || donation.points === null) {
        return res.status(404).send("Donation not found or points are null");
      }
    
      // Update the donation status using donationId and newStatus
      await prisma.donation.update({
        where: { id: donationId },
        data: { status: newStatus },
      });
  
      // Proceed with updating the organization's points if the new status is "VERIFIED" or "ACCEPTEDWITHISSUES"
      if (newStatus === "VERIFIED" || newStatus === "ACCEPTEDWITHISSUES") {
        // Fetch the existing organization
        const organization = await prisma.organization.findUnique({
          where: { id: donation.organizationId }
        });

        if (!organization) {
          return res.status(404).send("Organization not found");
        }

        const newTotalPoints = (organization.totalPoints || 0) + (donation.points || 0);
        const newLifetimePoints = (organization.lifetimePoints || 0) + (donation.points || 0); // Added this line


        // Update the organization's totalPoints
        await prisma.organization.update({
          where: { id: donation.organizationId },
          data: {
             totalPoints: newTotalPoints,
             lifetimePoints: newLifetimePoints 
            }
        });

        // Count the number of donations for the organization
        const numberOfDonations = await prisma.donation.count({
          where: { organizationId: donation.organizationId }
        });  
 
        sendMilestoneCertificate(organization, numberOfDonations)
          .then(result => console.log('Certificate process completed:', result))
          .catch(error => console.error('Certificate process failed:', error));
        
      } 
  
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
   