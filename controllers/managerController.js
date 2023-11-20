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
        case (numberOfDonations === 5):
          certificateDetails = {
            file: 'Gold-Level.pdf',
            position: { x: 250, y: 260 },
            size: 45,
            color: rgb(176 / 255, 126 / 255, 9 / 255)
          };
          break;
        case (numberOfDonations === 10):
          certificateDetails = {
            file: 'Diamond-Level.pdf',
            position: { x: 170, y: 265 },
            size: 40,
            color: rgb(107 / 255, 77 / 255, 33 / 255)
          };
          break;
        case (numberOfDonations === 20):
          certificateDetails = {
            file: 'Platinum-Level.pdf',
            position: { x: 270, y: 300 },
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

async function aggregateDonationsByDay(donations) {
  const donationCounts = {};

  donations.forEach(donation => {
    const date = donation.createdAt.toISOString().split('T')[0]; // Get date in YYYY-MM-DD format
    donationCounts[date] = (donationCounts[date] || 0) + 1;
  });

  return Object.entries(donationCounts).map(([date, count]) => ({
    x: new Date(date).getTime(), // Convert date to timestamp
    y: count
  }));
}

async function aggregateFeedbackByTimePeriod(feedbackTrends) {
  // Object to hold the aggregated data
  const aggregatedData = {};

  feedbackTrends.forEach(feedback => {
    // Convert the date to a YYYY-MM-DD string
    const dateKey = feedback.createdAt.toISOString().split('T')[0];

    if (!aggregatedData[dateKey]) {
      aggregatedData[dateKey] = {
        totalRatings: 0,
        count: 0,
        averageRating: 0
      };
    }

    aggregatedData[dateKey].totalRatings += feedback.rating;
    aggregatedData[dateKey].count += 1;
    aggregatedData[dateKey].averageRating = aggregatedData[dateKey].totalRatings / aggregatedData[dateKey].count;
  });

  // Convert the aggregated data into an array suitable for charting
  return Object.keys(aggregatedData).map(dateKey => {
    return {
      date: dateKey,
      averageRating: aggregatedData[dateKey].averageRating
    };
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

      // Extract the drop point name and operating hours
      const dropPointName = managerWithDropPoint.dropPoint[0]?.name || "Unnamed Drop Point";
      const openingTime = managerWithDropPoint.dropPoint[0]?.openingTime || "Not Available";
      const closingTime = managerWithDropPoint.dropPoint[0]?.closingTime || "Not Available";

      // Render the dashboard with the manager's profile and drop point name
      res.render('manager/dashboard', {
        manager: managerWithDropPoint,
        dropPointName,
        openingTime,
        closingTime
      });

    } catch (error) {
      console.error("Error fetching manager's profile:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getDonationOverview(req, res) {
    try {
      // Fetch the manager's drop point ID from the session
      const managerId = req.session.managerId;

      // Fetch the associated drop point details
      const managerWithDropPoint = await prisma.manager.findUnique({
        where: {
          id: managerId
        },
        include: {
          dropPoint: true
        }
      });

      // Check if managerWithDropPoint or managerWithDropPoint.dropPoint is null
      if (!managerWithDropPoint || !managerWithDropPoint.dropPoint) {
        return res.status(404).send("Associated drop point not found");
      }

      // Extract the drop point ID
      const dropPointId = managerWithDropPoint.dropPoint[0]?.id;

      // Fetch donations grouped by status for a specific drop point
      const donationsByStatus = await prisma.donation.groupBy({
        where: {
          dropPointId: dropPointId
        },
        by: ['status'],
        _count: {
          id: true
        }
      });

      // Prepare main data for the pie chart
      const mainData = donationsByStatus.map(item => ({
        name: item.status,
        y: item._count.id,
        drilldown: item.status
      }));

      // Prepare drilldown data
      const drilldownData = await Promise.all(donationsByStatus.map(async (item) => {
        // Fetch more detailed data for each status for the specific drop point
        const detailedData = await prisma.donation.findMany({
          where: {
            status: item.status,
            dropPointId: dropPointId
          },
          select: {
            organization: true, // Assuming you want to show organization details in drilldown
            createdAt: true,
            points: true
          }
        });

        // Format the detailed data
        const data = detailedData.map(donation => {
          return [
            donation.organization.organizationname, // Display organization name
            donation.points // Display points for each donation
          ];
        });

        return {
          name: item.status,
          id: item.status,
          data: data
        };
      }));

      res.json({ mainData, drilldownData });
    } catch (error) {
      console.error("Error in getDonationOverview:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getRecentDonations(req, res) {
    try {
      // Fetch recent donations for the manager's drop point
      const managerId = req.session.managerId;
      const managerWithDropPoint = await prisma.manager.findUnique({
        where: { id: managerId },
        include: { dropPoint: true }
      });

      if (!managerWithDropPoint || !managerWithDropPoint.dropPoint) {
        return res.status(404).send("Associated drop point not found");
      }

      const dropPointId = managerWithDropPoint.dropPoint[0]?.id;

      const recentDonations = await prisma.donation.findMany({
        where: {
          dropPointId: dropPointId
          // Add any necessary conditions, like a date range
        },
        include: {
          organization: true,
          peripherals: true // Assuming peripherals contain the quantity
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10 // Adjust the number of donations to fetch
      });

      const formattedData = recentDonations.map(donation => {
        // Sum up the quantities of all peripherals in the donation
        const totalQuantity = donation.peripherals.reduce((sum, peripheral) => sum + peripheral.quantity, 0);

        return {
          id: donation.id,
          organizationName: donation.organization.organizationname,
          date: donation.createdAt.toISOString().split('T')[0], // Format the date
          status: donation.status,
          quantity: totalQuantity // Use the total quantity
        };
      });

      const drilldownData = await Promise.all(recentDonations.map(async (donation) => {
        const peripherals = await prisma.peripheral.findMany({
          where: { donationId: donation.id }
        });

        return {
          id: donation.id, // Use donation ID for drilldown
          data: peripherals.map(peripheral => ({
            name: `${peripheral.type} - ${peripheral.condition}`,
            y: peripheral.quantity
          }))
        };
      }));

      res.json(formattedData);
    } catch (error) {
      console.error("Error in getRecentDonations:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getDonationTrends(req, res) {
    try {
      // Fetch the earliest and latest donation dates
      const earliestDonation = await prisma.donation.findFirst({
        orderBy: {
          createdAt: 'asc'
        },
        select: {
          createdAt: true
        }
      });

      const latestDonation = await prisma.donation.findFirst({
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          createdAt: true
        }
      });

      // Check if dates are available
      if (!earliestDonation || !latestDonation) {
        return res.status(404).send("No donations found");
      }

      const startDate = earliestDonation.createdAt;
      const endDate = latestDonation.createdAt;

      // Fetch donations within the date range
      const donations = await prisma.donation.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          createdAt: true,
          id: true
        }
      });

      // Aggregate the data
      const aggregatedData = await aggregateDonationsByDay(donations);

      res.json(aggregatedData);
    } catch (error) {
      console.error("Error in getDonationTrends:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getRecentFeedback(req, res) {
    try {
      const managerId = req.session.managerId;

      const managerWithDropPoint = await prisma.manager.findUnique({
        where: {
          id: managerId
        },
        include: {
          dropPoint: true
        }
      });

      if (!managerWithDropPoint || !managerWithDropPoint.dropPoint) {
        return res.status(404).send("Associated drop point not found");
      }

      const dropPointId = managerWithDropPoint.dropPoint[0]?.id;

      const recentFeedback = await prisma.feedback.findMany({
        where: {
          dropPointId: dropPointId
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10,
        include: {
          organization: true
        }
      });

      res.json(recentFeedback);
    } catch (error) {
      console.error("Error in getRecentFeedback:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getFeedbackSummary(req, res) {
    try {
      const managerId = req.session.managerId;

      const managerWithDropPoint = await prisma.manager.findUnique({
        where: {
          id: managerId
        },
        include: {
          dropPoint: true
        }
      });

      if (!managerWithDropPoint || !managerWithDropPoint.dropPoint) {
        return res.status(404).send("Associated drop point not found");
      }

      const dropPointId = managerWithDropPoint.dropPoint[0]?.id;

      const feedbackSummary = await prisma.feedback.groupBy({
        where: {
          dropPointId: dropPointId
        },
        by: ['rating'],
        _count: {
          rating: true
        }
      });

      res.json(feedbackSummary);
    } catch (error) {
      console.error("Error in getFeedbackSummary:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getFeedbackTrends(req, res) {
    try {
      const managerId = req.session.managerId;

      const managerWithDropPoint = await prisma.manager.findUnique({
        where: {
          id: managerId
        },
        include: {
          dropPoint: true
        }
      });

      if (!managerWithDropPoint || !managerWithDropPoint.dropPoint) {
        return res.status(404).send("Associated drop point not found");
      }

      const dropPointId = managerWithDropPoint.dropPoint[0]?.id;

      // Find the oldest and newest feedback dates for the specific drop point
      const oldestFeedback = await prisma.feedback.findFirst({
        where: {
          dropPointId: dropPointId
        },
        orderBy: {
          createdAt: 'asc'
        },
        select: {
          createdAt: true
        }
      });

      const newestFeedback = await prisma.feedback.findFirst({
        where: {
          dropPointId: dropPointId
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          createdAt: true
        }
      });

      if (!oldestFeedback || !newestFeedback) {
        return res.status(404).send("No feedback found");
      }

      const startDate = new Date(oldestFeedback.createdAt);
      const endDate = new Date(newestFeedback.createdAt);

      const feedbackTrends = await prisma.feedback.findMany({
        where: {
          dropPointId: dropPointId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          createdAt: true,
          rating: true
        }
      });

      const aggregatedData = await aggregateFeedbackByTimePeriod(feedbackTrends);

      res.json(aggregatedData);
    } catch (error) {
      console.error("Error in getFeedbackTrends:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getDonationReports(req, res) {
    try {
      const managerId = req.session.managerId;

      // Assuming each manager is associated with one drop point
      const manager = await prisma.manager.findUnique({
        where: { id: managerId },
        include: { dropPoint: true }
      });

      if (!manager || !manager.dropPoint) {
        return res.status(404).send("Manager or associated drop point not found");
      }

      const dropPointId = manager.dropPoint.id;

      // Example: Fetch total donations count
      const totalDonations = await prisma.donation.count({
        where: { dropPointId: dropPointId }
      });

      // Add more queries as needed for detailed breakdowns

      res.json({ totalDonations });
    } catch (error) {
      console.error("Error in getDonationReports:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getPerformanceMetrics(req, res) {
    try {
      const managerId = req.session.managerId;

      const manager = await prisma.manager.findUnique({
        where: { id: managerId },
        include: { dropPoint: true }
      });

      if (!manager || !manager.dropPoint) {
        return res.status(404).send("Manager or associated drop point not found");
      }

      const dropPointId = manager.dropPoint.id;

      // Example: Calculate average feedback score
      const averageFeedbackScore = await prisma.feedback.aggregate({
        where: { dropPointId: dropPointId },
        _avg: { rating: true }
      });

      // Add more queries for other KPIs like donation turnaround time

      res.json({ averageFeedbackScore: averageFeedbackScore._avg.rating });
    } catch (error) {
      console.error("Error in getPerformanceMetrics:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getUserEngagement(req, res) {
    try {
      const managerId = req.session.managerId;

      const managerWithDropPoint = await prisma.manager.findUnique({
        where: { id: managerId },
        include: { dropPoint: true }
      });

      if (!managerWithDropPoint || !managerWithDropPoint.dropPoint) {
        return res.status(404).send("Associated drop point not found");
      }

      const dropPointId = managerWithDropPoint.dropPoint.id;

      // Fetch frequency of donations by each organization
      const donationFrequency = await prisma.donation.groupBy({
        by: ['organizationId'],
        where: {
          dropPointId: dropPointId,
        },
        _count: {
          organizationId: true, // Count by organizationId
        },
        _sum: {
          points: true,
        },
        _avg: {
          points: true,
        },
        orderBy: {
          _count: {
            organizationId: 'desc', // Order by count of organizationId
          },
        },
      }).then(donations => {
        return Promise.all(donations.map(async donation => {
          const organization = await prisma.organization.findUnique({
            where: { id: donation.organizationId },
            select: { organizationname: true },
          });
          return { ...donation, organizationname: organization?.organizationname };
        }));
      });
      



      // Fetch types of items donated
      const donationTypes = await prisma.peripheral.groupBy({
        by: ['type'],
        where: { donation: { dropPointId: dropPointId } },
        _count: true
      });

      res.json({ donationFrequency, donationTypes });
    } catch (error) {
      console.error("Error in getUserEngagement:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getOrganizationProfiles(req, res) {
    try {
      const managerId = req.session.managerId;

      const managerWithDropPoint = await prisma.manager.findUnique({
        where: { id: managerId },
        include: { dropPoint: true }
      });

      if (!managerWithDropPoint || !managerWithDropPoint.dropPoint) {
        return res.status(404).send("Associated drop point not found");
      }

      const dropPointId = managerWithDropPoint.dropPoint.id;

      // Fetch organizations with their donation details
      const organizations = await prisma.organization.findMany({
        where: { donations: { some: { dropPointId: dropPointId } } },
        include: {
          donations: {
            where: { dropPointId: dropPointId },
            select: { id: true, createdAt: true, points: true }
          }
        }
      });

      res.json(organizations);
    } catch (error) {
      console.error("Error in getOrganizationProfiles:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getManageDonation(req, res) {
    try {
      const page = parseInt(req.query.page) || 1; // Current page number
      const limit = parseInt(req.query.limit) || 10; // Number of items per page
      const skip = (page - 1) * limit;

      const searchQuery = req.query.search || '';
      const filterDate = req.query.date || '';
      const filterStatus = req.query.status || '';
      const sortParam = req.query.sort || 'expectedDateOfArrival_asc'; // Default sorting parameter

      let whereClause = {
        isSubmitted: true,
        organization: {
          organizationname: {
            contains: searchQuery,
            mode: 'insensitive'
          }
        }
      };

      if (filterDate) {
        // Adjust this based on how your dates are stored and queried in your database
        whereClause.expectedDateOfArrival = {
          equals: new Date(filterDate)
        };
      }

      if (filterStatus) {
        whereClause.status = filterStatus;
      }

      // Parsing sort parameter
      const [sortField, sortOrder] = sortParam.split('_');
      let orderByClause = {};
      orderByClause[sortField] = sortOrder;

      // Fetch the manager's profile and associated drop point using the ID stored in the session
      const managerWithDropPoint = await prisma.manager.findUnique({
        where: {
          id: req.session.managerId
        },
        include: {
          dropPoint: {
            include: {
              donations: {
                where: whereClause,
                skip: skip,
                take: limit,
                orderBy: orderByClause,
                include: {
                  organization: true,
                  peripherals: true
                }  // Fetch related organization for each donation
              }
            }
          }
        }
      });

      // Calculate total number of donations
      const totalDonations = await prisma.donation.count({
        where: {
          dropPointId: managerWithDropPoint.dropPoint[0]?.id,
          isSubmitted: true
        }
      });
      const totalPages = Math.ceil(totalDonations / limit);

      // Get the drop point name from the first drop point (if it exists)
      const dropPointName = managerWithDropPoint.dropPoint[0]?.name || "Unnamed Drop Point";

      // Render the manageDonation view, passing in the donations and dropPoint name
      res.render('manager/manageDonation', {
        donations: managerWithDropPoint.dropPoint[0]?.donations || [],
        dropPointName: dropPointName,
        currentPage: page,
        totalPages: totalPages
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

  async postUpdatePeripheral(req, res) {
    try {
      const { peripheralId, condition, quantity } = req.body;

      // Fetch the current details of the peripheral
      const currentPeripheral = await prisma.peripheral.findUnique({
        where: { id: peripheralId },
        include: { donation: true }
      });

      let deduction = 0;

      // Check for condition change and apply deductions
      if (currentPeripheral.condition !== condition) {
        deduction += 2; // Deduct 2 points for condition change
      }

      // Check for quantity change and apply deductions
      if (currentPeripheral.quantity !== parseInt(quantity)) {
        // Deduct 1 point per item reduced
        const quantityChange = currentPeripheral.quantity - parseInt(quantity);
        if (quantityChange > 0) { // Ensure deduction only if quantity is reduced
          deduction += quantityChange;
        }
      }

      // Update the peripheral in the database
      await prisma.peripheral.update({
        where: { id: peripheralId },
        data: { condition, quantity: parseInt(quantity) }
      });

      // Update the donation's points
      const newTotalPoints = Math.max(0, currentPeripheral.donation.points - deduction); // Ensure points do not go below zero
      await prisma.donation.update({
        where: { id: currentPeripheral.donationId },
        data: { points: newTotalPoints }
      });

      res.redirect('/manager/manageDonation');
    } catch (error) {
      console.error("Error updating peripheral:", error);
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

      // Extract drop point details
      const dropPoint = managerWithDropPoint.dropPoint[0] || {};
      const dropPointName = dropPoint.name || "Unnamed Drop Point";
      const dropPointLocation = dropPoint.location || "N/A";
      const dropPointOpeningTime = dropPoint.openingTime || "N/A";
      const dropPointClosingTime = dropPoint.closingTime || "N/A";
      const dropPointDescription = dropPoint.description || "No description available";

      // Render the manager account page with the manager's profile and drop point details
      res.render('manager/manageraccount', {
        manager: managerWithDropPoint,
        dropPointName,
        dropPointLocation,
        dropPointOpeningTime,
        dropPointClosingTime,
        dropPointDescription
      });

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
