require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

function isPDF(filename) {
  return filename.toLowerCase().endsWith('.pdf');
}
function isDOCX(filename) {
  return filename.toLowerCase().endsWith('.docx');
}

function addListingsToActivityLog(user, activityType, activityLog, userName) {
  if (!activityType || activityType === 'Listing Created') {
    user.listings.forEach(listing => {
      if (listing && listing.title) {
        activityLog.push({
          activityType: 'Listing Created',
          date: listing.createdAt,
          userName,
          details: `Listing Title: ${listing.title}`,
        });
      }
    });
  }
}

function addPurchasesToActivityLog(user, activityType, activityLog, userName) {
  if (!activityType || activityType === 'Sale Made') {
    user.purchases.forEach(purchase => {
      if (purchase && purchase.listing && purchase.listing.title) {
        activityLog.push({
          activityType: 'Sale Made',
          date: purchase.saleDate,
          userName,
          details: `Purchased Listing: ${purchase.listing.title}`,
        });
      }
    });
  }
}

function applyDateFiltersAndSort(activityLog, startDate, endDate, dateOrder) {
  if (startDate || endDate) {
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    activityLog = activityLog.filter(activity => {
      const activityDate = new Date(activity.date);
      return activityDate >= start && activityDate <= end;
    });
  }
  activityLog.sort((a, b) => dateOrder === 'desc' ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date));
}

function paginateActivities(activityLog, skip, limit) {
  return activityLog.slice(skip, skip + limit);
}

module.exports = {
  async getAdminLogin(req, res) {
    res.render('admin/login');
  },

  async getGenderDistribution(req, res) {
    try {
      const genderDistribution = await prisma.user.groupBy({
        by: ['gender'],
        _count: {
          gender: true
        }
      });
      res.json(genderDistribution);
    } catch (error) {
      res.status(500).send('Server Error');
    }
  },

  async getUserSignups(req, res) {
    try {
      const userSignups = await prisma.user.findMany({
        select: {
          createdAt: true
        }
      });

      const groupedByDate = userSignups.reduce((acc, user) => {
        const date = user.createdAt.toISOString().split('T')[0]; // Get date in 'YYYY-MM-DD' format
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      const formattedData = Object.entries(groupedByDate).map(([date, count]) => {
        return { date, count };
      });

      res.json(formattedData);
    } catch (error) {
      res.status(500).send('Server Error');
    }
  },

  async getUsersByCity(req, res) {
    try {
      // Fetch all cities with the count of users
      const citiesWithUserCount = await prisma.city.findMany({
        include: {
          _count: {
            select: { users: true } // Count the users related to each city
          }
        }
      });

      // Sort cities based on the count of users in descending order
      citiesWithUserCount.sort((a, b) => b._count.users - a._count.users);

      res.json(citiesWithUserCount);
    } catch (error) {
      console.error("Error fetching users by city:", error);
      res.status(500).send('Server Error: ' + error.message);
    }
  },

  async getOrganizationsByVerification(req, res) {
    try {
      const organizationsByVerification = await prisma.organization.groupBy({
        by: ['verificationStatus'],
        _count: {
          verificationStatus: true
        }
      });

      res.json(organizationsByVerification);
    } catch (error) {
      console.error("Error fetching organizations by verification status:", error);
      res.status(500).send('Server Error: ' + error.message);
    }
  },

  async getOrganizationPointsOverTime(req, res) {
    try {
      const organizationPointsOverTime = await prisma.organization.findMany({
        select: {
          createdAt: true,
          totalPoints: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      // Format the data for the line chart
      const formattedData = organizationPointsOverTime.map(org => {
        return {
          date: org.createdAt.toISOString().split('T')[0], // Format date as 'YYYY-MM-DD'
          totalPoints: org.totalPoints
        };
      });

      res.json(formattedData);
    } catch (error) {
      console.error("Error fetching organization points over time:", error);
      res.status(500).send('Server Error: ' + error.message);
    }
  },

  async getDonationsOverTime(req, res) {
    try {
      const donations = await prisma.donation.findMany({
        select: {
          createdAt: true
        }
      });

      const groupedByDate = donations.reduce((acc, donation) => {
        const date = donation.createdAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      const formattedData = Object.entries(groupedByDate).map(([date, count]) => {
        return { date, count };
      });

      res.json(formattedData);
    } catch (error) {
      console.error("Error fetching donations over time:", error);
      res.status(500).send('Server Error: ' + error.message);
    }
  },

  async getDonationStatusDistribution(req, res) {
    try {
      const donationsByStatus = await prisma.donation.groupBy({
        by: ['status'],
        _count: {
          status: true
        }
      });

      res.json(donationsByStatus);
    } catch (error) {
      console.error("Error fetching donation status distribution:", error);
      res.status(500).send('Server Error: ' + error.message);
    }
  },

  async getAverageRatingPerDropPoint(req, res) {
    try {
      // Fetch all feedbacks
      const feedbacks = await prisma.feedback.findMany({
        select: {
          rating: true,
          dropPointId: true
        }
      });

      // Filter out feedbacks without a valid dropPointId
      const validFeedbacks = feedbacks.filter(fb => fb.dropPointId);

      // Manual aggregation for drop points
      const aggregatedRatings = {};
      validFeedbacks.forEach(fb => {
        const key = fb.dropPointId;
        if (!aggregatedRatings[key]) {
          aggregatedRatings[key] = { totalRating: 0, count: 0 };
        }
        aggregatedRatings[key].totalRating += fb.rating;
        aggregatedRatings[key].count++;
      });

      // Fetch names of drop points and prepare response
      const response = await Promise.all(Object.keys(aggregatedRatings).map(async key => {
        const { totalRating, count } = aggregatedRatings[key];
        const averageRating = totalRating / count;

        const dp = await prisma.dropPoint.findUnique({
          where: { id: key },
          select: { name: true }
        });
        const name = dp ? dp.name : 'Unknown Drop Point';

        return { name, averageRating, count }; // Include count in the response
      }));

      res.json(response);
    } catch (error) {
      console.error("Error fetching average ratings for drop points:", error);
      res.status(500).send('Server Error: ' + error.message);
    }
  },

  async getRatingsDistribution(req, res) {
    try {
      const ratingsDistribution = await prisma.feedback.groupBy({
        by: ['rating'],
        _count: {
          rating: true
        },
        orderBy: {
          rating: 'desc'
        }
      });

      // Initialize an object with all ratings set to 0
      let ratingsCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      // Update counts based on the database response
      ratingsDistribution.forEach(item => {
        ratingsCount[item.rating] = item._count.rating;
      });

      // Convert to array format for Highcharts
      const formattedData = Object.keys(ratingsCount).map(key => {
        return { rating: key, count: ratingsCount[key] };
      });

      res.json(formattedData);
    } catch (error) {
      console.error("Error fetching ratings distribution:", error);
      res.status(500).send('Server Error: ' + error.message);
    }
  },

  async getAdInteractionsOverTime(req, res) {
    try {
      const adInteractions = await prisma.adInteraction.groupBy({
        by: ['clickedAt'],
        _count: {
          id: true
        },
        orderBy: {
          clickedAt: 'asc'
        }
      });

      // Format data for the line chart
      const formattedData = adInteractions.map(interaction => {
        return {
          date: interaction.clickedAt.toISOString().split('T')[0], // Format date as YYYY-MM-DD
          count: interaction._count.id
        };
      });

      // Aggregate counts by date
      const aggregatedData = formattedData.reduce((acc, curr) => {
        const date = curr.date;
        if (!acc[date]) {
          acc[date] = 0;
        }
        acc[date] += curr.count;
        return acc;
      }, {});

      // Convert aggregated data into array format
      const finalData = Object.keys(aggregatedData).map(date => {
        return { date: date, count: aggregatedData[date] };
      });

      res.json(finalData);
    } catch (error) {
      console.error("Error fetching ad interactions over time:", error);
      res.status(500).send('Server Error: ' + error.message);
    }
  },

  async getPointsSpentOnAds(req, res) {
    try {
      // Step 1: Group and sum points spent by organizationId
      const pointsSpent = await prisma.advertisement.groupBy({
        by: ['organizationId'],
        _sum: {
          pointsSpent: true
        }
      });

      // Step 2: Fetch organization names separately
      const organizationIds = pointsSpent.map(item => item.organizationId);
      const organizations = await prisma.organization.findMany({
        where: {
          id: { in: organizationIds }
        },
        select: {
          id: true,
          organizationname: true
        }
      });

      // Create a map for quick lookup
      const organizationMap = organizations.reduce((map, org) => {
        map[org.id] = org.organizationname;
        return map;
      }, {});

      // Format data for the bar chart
      const formattedData = pointsSpent.map(item => {
        return {
          organization: organizationMap[item.organizationId],
          pointsSpent: item._sum.pointsSpent || 0
        };
      });

      res.json(formattedData);
    } catch (error) {
      console.error("Error fetching points spent on ads:", error);
      res.status(500).send('Server Error: ' + error.message);
    }
  },

  async getListingsPerCategory(req, res) {
    try {
      // Step 1: Perform groupBy operation
      const listingsPerCategory = await prisma.listing.groupBy({
        by: ['categoryId'],
        _count: {
          id: true
        },
        _avg: {
          price: true
        }
      });

      // Step 2: Fetch categories and create a mapping
      const categories = await prisma.category.findMany({
        select: {
          id: true,
          name: true
        }
      });
      const categoryMapping = categories.reduce((acc, category) => {
        acc[category.id] = category.name;
        return acc;
      }, {});

      // Step 3: Map results to include category names
      const formattedData = listingsPerCategory.map(item => {
        return {
          category: categoryMapping[item.categoryId],
          count: item._count.id,
          averagePrice: item._avg.price
        };
      });

      // Step 4: Sort the results (e.g., by count in descending order)
      formattedData.sort((a, b) => b.count - a.count);

      res.json(formattedData);
    } catch (error) {
      console.error("Error fetching listings per category:", error);
      res.status(500).send('Server Error: ' + error.message);
    }
  },

  async getSalesOverTime(req, res) {
    try {
      const salesOverTime = await prisma.sale.groupBy({
        by: ['saleDate'],
        _count: {
          id: true
        },
        orderBy: {
          saleDate: 'asc'
        }
      });

      const formattedData = salesOverTime.map(sale => {
        return {
          date: sale.saleDate.toISOString().split('T')[0], // Format date as YYYY-MM-DD
          count: sale._count.id
        };
      });

      res.json(formattedData);
    } catch (error) {
      console.error("Error fetching sales over time:", error);
      res.status(500).send('Server Error: ' + error.message);
    }
  },

  async getMessagesPerUser(req, res) {
    try {
      const messagesPerUser = await prisma.message.groupBy({
        by: ['senderId'],
        _count: {
          id: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        }
      });

      // Map the senderId to user details (e.g., firstName, lastName)
      const detailedMessagesPerUser = await Promise.all(messagesPerUser.map(async (message) => {
        const user = await prisma.user.findUnique({
          where: { id: message.senderId },
          select: { firstName: true, lastName: true }
        });
        return {
          user: `${user.firstName} ${user.lastName}`,
          count: message._count.id
        };
      }));

      res.json(detailedMessagesPerUser);
    } catch (error) {
      console.error("Error fetching messages per user:", error);
      res.status(500).send('Server Error: ' + error.message);
    }
  },

  async getConversationsOverTime(req, res) {
    try {
      const conversationsOverTime = await prisma.conversation.groupBy({
        by: ['createdAt'],
        _count: {
          id: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      const formattedData = conversationsOverTime.map(conversation => {
        return {
          date: conversation.createdAt.toISOString().split('T')[0], // Format date as YYYY-MM-DD
          count: conversation._count.id
        };
      });

      res.json(formattedData);
    } catch (error) {
      console.error("Error fetching conversations over time:", error);
      res.status(500).send('Server Error: ' + error.message);
    }
  },

  async getUserActivityHeatMap(req, res) {
    try {
      // Aggregate user activity (e.g., messages sent) by day of week and hour
      const userActivity = await prisma.message.groupBy({
        by: [
          'createdAt'
        ],
        _count: {
          id: true
        }
      });

      // Process data to fit the format required for a heat map
      const heatMapData = userActivity.map(activity => {
        return {
          day: activity.createdAt.getDay(), // Day of the week
          hour: activity.createdAt.getHours(), // Hour of the day
          count: activity._count.id
        };
      });

      res.json(heatMapData);
    } catch (error) {
      console.error("Error fetching user activity heat map data:", error);
      res.status(500).send('Server Error: ' + error.message);
    }
  },

  async getActivitySalesCorrelation(req, res) {
    try {
      // Fetch user activity data (e.g., number of messages sent)
      const userActivity = await prisma.message.groupBy({
        by: ['senderId'],
        _count: {
          id: true
        }
      });

      // Fetch sales data
      const salesData = await prisma.sale.groupBy({
        by: ['buyerId'],
        _count: {
          id: true
        }
      });

      // Process and correlate the data
      const correlationData = userActivity.map(activity => {
        const sales = salesData.find(sale => sale.buyerId === activity.senderId) || { _count: { id: 0 } };
        return {
          userId: activity.senderId,
          messagesSent: activity._count.id,
          salesMade: sales._count.id
        };
      });

      res.json(correlationData);
    } catch (error) {
      console.error("Error fetching activity-sales correlation data:", error);
      res.status(500).send('Server Error: ' + error.message);
    }
  },

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
      res.render('admin/login', { message: 'An error occurred' });
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

  async getMarketplaceManagement(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const tab = req.query.tab || 'pending';
      const limit = 10;
      const skip = (page - 1) * limit;
      
      let whereClause;
      if (tab === 'pending') {
        whereClause = {
          AND: [
            { reports: { some: {} } },
            { status: 'AVAILABLE' }
          ]
        };
      }
      
      const listings = await prisma.listing.findMany({
        where: whereClause,
        include: {
          user: true,
          photos: true,
          reports: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: skip
      });
  
      const totalListings = await prisma.listing.count({ where: whereClause });
      const totalPages = Math.ceil(totalListings / limit);
  
      res.render('admin/marketplacemanagement', { listings, page, totalPages, tab });
    } catch (error) {
      console.error('Error fetching listings:', error);
      res.status(500).send('Error fetching listings');
    }
  },

  async getListingPhoto(req, res) {
    const { listingId, photoIndex } = req.params;

    try {
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        include: { photos: true }
      });

      if (listing && listing.photos && listing.photos[photoIndex]) {
        const photo = listing.photos[photoIndex];
        // Assuming imageUrl is a base64 encoded string
        const imgBuffer = Buffer.from(photo.imageUrl, 'base64');
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Content-Length': imgBuffer.length
        });
        res.end(imgBuffer);
      } else {
        res.status(404).send('Image not found');
      }
    } catch (error) {
      console.error('Error fetching photo:', error);
      res.status(500).send('Error fetching photo');
    }
  },

  async getManagerManagement(req, res) {
    try {
      const page = parseInt(req.query.page) || 1; // Get current page from query, default is 1
      const limit = 5; // Limit number of managers per page
      const skip = (page - 1) * limit; // Calculate the offset
      const searchQuery = req.query.search || '';
      let filter = {};

      if (searchQuery) {
        filter = {
          OR: [
            {
              firstName: {
                contains: searchQuery,
                mode: 'insensitive',
              },
            },
            {
              lastName: {
                contains: searchQuery,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: searchQuery,
                mode: 'insensitive',
              },
            },
          ],
        };
      }


      // Fetch limited managers with offset
      const managers = await prisma.manager.findMany({
        where: filter,
        skip: skip,
        take: limit
      });

      // Calculate total number of managers for pagination
      const totalManagers = await prisma.manager.count({ where: filter });
      const totalPages = Math.ceil(totalManagers / limit);

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

      res.render('admin/managermanagement', {
        managers: managersWithStatus,
        totalPages,
        currentPage: page
      });
    } catch (error) {
      console.error("Error fetching managers:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getManagerActivities(req, res) {
    try {
      const managerId = req.params.managerId; // Get manager ID from route parameter

      // Fetch donations associated with drop points managed by this manager
      const managedDonations = await prisma.donation.findMany({
        where: {
          dropPoint: {
            managerId: managerId,
          },
        },
        include: {
          organization: true, // Include related organization data
          dropPoint: true, // Include drop point data
          peripherals: true, // Include peripheral data if needed
        }
      });

      // Transform data to a more log-like structure if needed
      const activityLogs = managedDonations.map(donation => ({
        type: 'Donation Managed',
        donationId: donation.id,
        organizationName: donation.organization.organizationname,
        dropPointName: donation.dropPoint.name,
        date: donation.createdAt
        // Add other relevant information
      }));

      res.json(activityLogs); // Send log-like data as JSON response
    } catch (error) {
      console.error("Error fetching activities for manager:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getManagerDonations(req, res) {
    try {
      const managerId = req.params.managerId;

      // Fetch donations where the drop point is managed by this manager
      const donations = await prisma.donation.findMany({
        where: {
          dropPoint: {
            managerId: managerId,
          },
        },
        include: {
          organization: true, // Include organization data
          dropPoint: true, // Include drop point data
          // other fields as needed
        }
      });

      res.json(donations);
    } catch (error) {
      console.error("Error fetching donations for manager:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getManagerFeedbacks(req, res) {
    try {
      const managerId = req.params.managerId;

      // Fetch feedbacks where the drop point is managed by this manager
      const feedbacks = await prisma.feedback.findMany({
        where: {
          dropPoint: {
            managerId: managerId,
          },
        },
        include: {
          organization: true, // Include organization data
          dropPoint: true, // Include drop point data
          // other fields as needed
        }
      });

      res.json(feedbacks);
    } catch (error) {
      console.error("Error fetching feedbacks for manager:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async postApproveListing(req, res) {
    const { listingId } = req.params;
  
    try {
      // Fetch the listing details
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        include: {
          user: true // Include the user who posted the listing
        }
      });
  
      // Fetch all reports related to the listing
      const reports = await prisma.report.findMany({
        where: { listingId: listingId },
        include: { reportedBy: true } // Include the user who made the report
      });
  
      // Clear reports for the listing
      await prisma.report.deleteMany({
        where: { listingId: listingId }
      });
  
      // Create email transporter
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
  
      // Notify each user who reported the listing
      reports.forEach(report => {
        const mailOptions = {
          from: process.env.EMAIL_USERNAME,
          to: report.reportedBy.email,
          subject: 'Report Review Update',
          html: `<div style="font-family: Arial, sans-serif; border: 1px solid #ccc; padding: 20px; margin: 10px;">
                  <h1>Report Update</h1>
                  <p>Your report for the listing titled "${listing.title}" has been reviewed. We have found that this listing does not violate our marketplace policies.</p>
                  <p>Thank you for helping us maintain a safe and trustworthy marketplace.</p>
                  <p>Best regards,</p>
                  <p>CycleUpTech Team</p>
                </div>`
        };
  
        transporter.sendMail(mailOptions);
      });
  
      res.redirect('/admin/marketplacemanagement');
    } catch (error) {
      console.error('Error approving listing:', error);
      res.status(500).send('Error approving listing');
    }
  },

  async postRejectListing(req, res) {
    const { listingId } = req.params;
  
    try {
      // Fetch the listing along with the user details
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        include: {
          user: true,
          reports: {
            include: {
              reportedBy: true // Include the users who made the reports
            }
          }
        }
      });

      // Delete associated photos and reports
      await prisma.photo.deleteMany({
        where: { listingId: listingId }
      });
      await prisma.report.deleteMany({
        where: { listingId: listingId }
      });
  
      // Delete the listing
      await prisma.listing.delete({
        where: { id: listingId }
      });
  
      // Create email transporter
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
  
      // Notify the user who posted the listing
      const mailOptionsPoster = {
        from: process.env.EMAIL_USERNAME,
        to: listing.user.email,
        subject: 'Listing Rejection Notice',
        html: `<div style="font-family: Arial, sans-serif; border: 1px solid #ccc; padding: 20px; margin: 10px;">
                <h1>Listing Rejection</h1>
                <p>Your listing titled "${listing.title}" has been reviewed and found in violation of our marketplace policies. As a result, it has been removed from the marketplace.</p>
                <p>For more information, please contact our support team.</p>
                <p>Best regards,</p>
                <p>CycleUpTech Team</p>
              </div>`
      };

      transporter.sendMail(mailOptionsPoster);

      // Notify users who made the reports
      listing.reports.forEach(report => {
        const mailOptionsReporter = {
          from: process.env.EMAIL_USERNAME,
          to: report.reportedBy.email,
          subject: 'Report Update on Listing',
          html: `<div style="font-family: Arial, sans-serif; border: 1px solid #ccc; padding: 20px; margin: 10px;">
                  <h1>Report Review Update</h1>
                  <p>Your report on the listing titled "${listing.title}" has been reviewed. The listing has been found in violation of our guidelines and removed from the marketplace.</p>
                  <p>Thank you for your vigilance in helping maintain a safe and trustworthy marketplace.</p>
                  <p>Best regards,</p>
                  <p>CycleUpTech Team</p>
                </div>`
        };

        transporter.sendMail(mailOptionsReporter);
      });
  
      res.redirect('/admin/marketplacemanagement');
    } catch (error) {
      console.error('Error rejecting listing:', error);
      res.status(500).send('Error rejecting listing');
    }
  },

  async getUserManagement(req, res) {
    try {
      const { activityType, startDate, endDate, page = 1, limit = 10, dateOrder = 'desc', userEmail } = req.query;
      const skip = (page - 1) * limit;

      let userSearchConditions = {};
      if (userEmail) userSearchConditions.email = { contains: userEmail };

      const users = await prisma.user.findMany({
        where: userSearchConditions,
        include: {
          city: true,
          listings: true,
          purchases: {
            include: {
              listing: true,
            },
          },
          receivedRatings: true, // Including ratings received by the user
        },
        skip: skip,
        take: limit,
      });

      // Enhance users with additional details
      const enhancedUsers = users.map(user => {
        const averageRating = user.receivedRatings.length > 0
          ? user.receivedRatings.reduce((acc, rating) => acc + rating.value, 0) / user.receivedRatings.length
          : 0;

        return {
          ...user,
          listingsCount: user.listings.length,
          purchasesCount: user.purchases.length,
          averageRating: averageRating.toFixed(1), // Rounded to 1 decimal place
        };
      });

      let activityLog = [];
      users.forEach(user => {
        const userName = `${user.firstName} ${user.lastName}`;
        addListingsToActivityLog(user, activityType, activityLog, userName);
        addPurchasesToActivityLog(user, activityType, activityLog, userName);
      });

      applyDateFiltersAndSort(activityLog, startDate, endDate, dateOrder);

      const totalUsersCount = await prisma.user.count({
        where: userSearchConditions
      });
      const totalUserPages = Math.ceil(totalUsersCount / limit);

      const paginatedActivities = paginateActivities(activityLog, skip, limit);
      const totalPages = Math.ceil(activityLog.length / limit);
      const activeTab = req.query.tab || (userEmail ? 'userDetails' : 'activityLog');

      res.render('admin/usermanagement', {
        users: enhancedUsers,
        activityLog: paginatedActivities,
        currentPage: parseInt(page, 10),
        totalPages,
        activeTab,
        totalUserPages,
        activityType,
        startDate,
        endDate,
        dateOrder,
        userEmail
      });
    } catch (error) {
      console.error('Error in getUserManagement:', error);
      res.status(500).send('Error retrieving user data');
    }
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
            <p>You can update this password in your profile settings for additional security.</p>
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

      // Fetch the DropPoint to find the current manager's ID
      const dropPoint = await prisma.dropPoint.findUnique({
        where: { id: dropPointId },
        include: { manager: true }
      });

      // Update the DropPoint to remove the manager's ID
      await prisma.dropPoint.update({
        where: { id: dropPointId },
        data: {
          managerId: null,
          password: null  // Optional: Reset the password if needed
        }
      });

      // Send an email to the removed manager if there was one
      if (dropPoint.manager) {
        const manager = dropPoint.manager;

        // Create email transporter
        const transporter = nodemailer.createTransport({
          service: process.env.EMAIL_SERVICE,
          auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD,
          },
        });

        // Set up formal email content
        const mailOptions = {
          from: process.env.EMAIL_USERNAME,
          to: manager.email,
          subject: 'Unassignment from Drop Point',
          html: `
            <div style="font-family: Arial, sans-serif; border: 1px solid #ccc; padding: 20px; margin: 10px;">
              <h1 style="color: #333366;">Unassignment from Drop Point</h1>
              <p>Dear ${manager.firstName} ${manager.lastName},</p>
              <p>We regret to inform you that you have been unassigned from the drop point named "${dropPoint.name}".</p>
              <p>If you have any questions or require further clarification, please contact our support team.</p>
              <p>Best regards,</p>
              <p>Your Team</p>
            </div>
          `,
        };

        // Send the email
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error("Email could not be sent:", error);
          } else {
            console.log("Email sent:", info.response);
          }
        });
      }

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

      // Fetch the DropPoint to find the current manager's ID
      const dropPoint = await prisma.dropPoint.findFirst({
        where: { id },
        include: { manager: true }
      });

      // Update the DropPoint
      await prisma.dropPoint.update({
        where: { id },
        data: {
          name,
          location,
          openingTime,
          closingTime,
          description,
        },
      });

      // Send an email to the assigned manager if there is one
      if (dropPoint.manager) {
        const manager = dropPoint.manager;

        // Create email transporter
        const transporter = nodemailer.createTransport({
          service: process.env.EMAIL_SERVICE,
          auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD,
          },
        });

        // Set up formal email content
        const mailOptions = {
          from: process.env.EMAIL_USERNAME,
          to: manager.email,
          subject: 'Drop Point Details Updated',
          html: `
          <div style="font-family: Arial, sans-serif; border: 1px solid #ccc; padding: 20px; margin: 10px;">
            <h1 style="color: #333366;">Drop Point Details Updated</h1>
            <p>Dear ${manager.firstName} ${manager.lastName},</p>
            <p>The drop point "${name}" to which you are assigned has had its details updated. The new details are as follows:</p>
            <ul>
              <li><strong>Name:</strong> ${name}</li>
              <li><strong>Location:</strong> ${location}</li>
              <li><strong>Opening Time:</strong> ${openingTime}</li>
              <li><strong>Closing Time:</strong> ${closingTime}</li>
              <li><strong>Description:</strong> ${description}</li>
            </ul>
            <p>If you have any questions, please contact our support team.</p>
            <p>Best regards,</p>
            <p>Your Team</p>
          </div>
        `,
        };

        // Send the email
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error("Email could not be sent:", error);
          } else {
            console.log("Email sent:", info.response);
          }
        });
      }

      res.redirect('/admin/droppointmanagement');
    } catch (error) {
      console.error("Error while updating drop point:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getAccount(req, res) {
    const admin = await prisma.admin.findUnique({
      where: { id: req.session.adminId.id },
    });
    res.render('admin/dashboard', { admin });
  },

  adminLogout(req, res) {
    // Clear the session to log out the user
    req.session.adminId = null;
    res.redirect('/admin/login');
  },
};