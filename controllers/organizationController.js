const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); 
const sharp = require('sharp');

async function calculatePoints(type, condition, quantity) {
    let basePoints = 0;
    let conditionPoints = 0;
    let quantityBonus = 0;
    
    // Criteria for types
    switch (type) {
      case 'Input Devices':
        basePoints += 0.5;
        break;
      case 'Storage Devices':
        basePoints += 1;
        break;
      case 'Memory and Processing':
        basePoints += 1.5;
        break;
      case 'Graphics and Video':
        basePoints += 2;
        break;
      case 'Power and Cooling':
        basePoints += 1;
        break;
      case 'Network and Sound':
        basePoints += 1;
        break;
      case 'Whole Systems':
        basePoints += 3;
        break;
      default:
        break;
    }
  
    // Criteria for condition
    if (condition === 'New') {
      conditionPoints += 2;
    } else if (condition === 'Used but Working') {
      conditionPoints += 1;
    } else if (condition === 'Not Working') {
      conditionPoints += 0.5;
    }
  
    // Criteria for quantity
    if (quantity >= 10 && quantity <= 49) {
      quantityBonus += 3;
    } else if (quantity >= 50) {
      quantityBonus += 5;
    }
  
    const points = ((basePoints + conditionPoints) * quantity);
    const totalPoints = points + quantityBonus;
  
    return totalPoints;
}

// Function to get total points for an organization
async function getTotalPointsForOrganization(organizationId) {
  try {
    const donations = await prisma.donation.findMany({
      where: {
        organizationId: organizationId,
        isSubmitted: true,
        OR: [
          { status: 'VERIFIED' },
          { status: 'ACCEPTEDWITHISSUES' }
        ]
      },
      select: {
        points: true
      }
    });

    let totalPoints = 0;
    donations.forEach(donation => {
      if (donation.points !== null) {
        totalPoints += donation.points;
      }
    });

    return totalPoints;
  } catch (error) {
    console.error("Error fetching total points:", error);
    return 0; // Return 0 if an error occurs
  }
}

// count registered users in a city
async function getCitiesWithUserCounts() {
  try {
    // Retrieve a list of cities and their total user counts 
    const cities = await prisma.city.findMany({
      select: {
        name: true,
        id: true,  // Add this 
        users: {
          select: {
            id: true, 
          },
        },
      },
    });

    // Calculate the total user count for each city 
    const citiesWithCounts = cities.map((city) => ({
      name: city.name,
      id: city.id, // Include the ID 
      usersCount: city.users.length,
    }));  

    return citiesWithCounts;
  } catch (error) {
    console.error("Error fetching cities with user counts:", error);
    return []; // Return an empty array if an error occurs
  }
}

async function calculateAdvertisementEngagement(advertisements) {
  const drilldownData = {};

  advertisements.forEach(ad => {
    ad.interactions.forEach(interaction => {
      const day = interaction.clickedAt.getDate();
      const month = interaction.clickedAt.getMonth() + 1;
      const year = interaction.clickedAt.getFullYear();
      const dateKey = `${day}-${month}-${year}`;
      const key = `${ad.title} | ${dateKey}`;

      if (!drilldownData[ad.title]) {
        drilldownData[ad.title] = {};
      }
      if (!drilldownData[ad.title][dateKey]) {
        drilldownData[ad.title][dateKey] = 0;
      }
      drilldownData[ad.title][dateKey]++;
    });
  });

  const chartData = Object.keys(drilldownData).map(title => {
    const totalInteractions = Object.values(drilldownData[title]).reduce((sum, count) => sum + count, 0);
    return {
      name: title,
      y: totalInteractions,
      drilldown: title
    };
  }).sort((a, b) => b.y - a.y); // Sort by total interactions in descending order

  const drilldownSeries = Object.entries(drilldownData).map(([title, data]) => {
    const sortedData = Object.entries(data).sort((a, b) => new Date(a[0]) - new Date(b[0]));
    return {
      name: title,
      id: title,
      data: sortedData.map(([date, count]) => [date, count])
    };
  });

  return { chartData, drilldownSeries };
}


async function calculateDonationDistribution(donations) {
  const distributionMap = {};

  donations.forEach(donation => {
    const dropPointId = donation.dropPointId;
    if (dropPointId) {
      distributionMap[dropPointId] = (distributionMap[dropPointId] || 0) + 1;
    }
  });

  const distribution = await Promise.all(
    Object.entries(distributionMap).map(async ([dropPointId, count]) => {
      const dropPoint = await prisma.dropPoint.findUnique({
        where: { id: dropPointId }
      });
      return { name: dropPoint.name, value: count };
    })
  );

  return distribution;
}

async function calculatePointsData(advertisements, donations) {
  const pointsData = {};

  // Accumulate points spent on advertisements
  advertisements.forEach(ad => {
    const monthYear = (ad.startDate.getMonth() + 1) + '-' + ad.startDate.getFullYear();
    pointsData[monthYear] = pointsData[monthYear] || { earned: 0, spent: 0 };
    pointsData[monthYear].spent += ad.pointsSpent;
  });

  // Accumulate points earned from donations
  donations.forEach(donation => {
    const monthYear = (donation.createdAt.getMonth() + 1) + '-' + donation.createdAt.getFullYear();
    pointsData[monthYear] = pointsData[monthYear] || { earned: 0, spent: 0 };
    pointsData[monthYear].earned += donation.points || 0; // Assuming 'points' field represents points earned
  });

  return Object.entries(pointsData).map(([date, data]) => ({
    date,
    earned: data.earned,
    spent: data.spent
  }));
}

async function calculateDonationTrend(donations) {
  const groupedDonations = donations.reduce((acc, donation) => {
    const monthYear = (donation.createdAt.getMonth() + 1) + '-' + donation.createdAt.getFullYear();
    if (!acc[monthYear]) {
      acc[monthYear] = 0;
    }
    acc[monthYear]++;
    return acc;
  }, {});

  return Object.entries(groupedDonations).map(([date, totalDonations]) => ({
    date,
    totalDonations
  }));
}


/**
 * Compute the average rating for feedbacks of a given drop point.
 * 
 * @param {Array} feedbacks - An array of feedback objects associated with the drop point.
 * @returns {number} - The average rating.
 */
function computeAverageRating(feedbacks) {
  if (!feedbacks || feedbacks.length === 0) return 0;

  const totalRating = feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0);
  return totalRating / feedbacks.length;
}
 
const updateAdStatuses = async (organizationId) => {
  try {
    // Get all ads for the organization where expiryDate is less than the current date and isActive is true
    const expiredAds = await prisma.advertisement.findMany({
      where: {
        organizationId: organizationId,
        expiryDate: {
          lt: new Date(), // 'lt' stands for 'less than'
        },
        isActive: true,
      },
    });

    // Update the status of ads to inactive
    const updatePromises = expiredAds.map(ad =>
      prisma.advertisement.update({
        where: { id: ad.id },
        data: { isActive: false },
      })
    );

    await Promise.all(updatePromises);
    console.log(`Updated ${expiredAds.length} ad(s) to inactive for organization ${organizationId}.`);
  } catch (error) {
    console.error('Failed to update ad statuses for organization:', organizationId, error);
  }
};


module.exports = {
  async getDashboard(req, res) {
    try {
        const organizationId = req.session.organizationId;  

        // Update ad statuses asynchronously
        updateAdStatuses(organizationId).catch(console.error);

        // Fetch drop points with managers
        const dropPointsWithManagers = await prisma.dropPoint.findMany({
            where: {
                NOT: {
                    managerId: null
                }
            },
            select: {
                id: true,
                name: true,
                location: true,
                openingTime: true,
                closingTime: true,
                description: true,
                manager: {
                    select: {
                        phoneNumber: true,
                        email: true
                    }
                }
            }
        });

        // Fetch all donations for the organization and associated drop points
        const donationsWithDropPoints = await prisma.donation.findMany({
            where: {
                organizationId: organizationId,
                isSubmitted: true
            },
            select: {
                id: true,
                peripherals: true, // Include the peripherals property
                dropPoint: {
                    select: {
                        id: true,
                    },
                },
                status: true,
                feedback: true,
            }
        });

        // Fetch feedbacks
        const allFeedbacks = await prisma.feedback.findMany({
          include: {
              donation: true,
              organization: {
                  select: {
                      organizationname: true
                  }
              }
          }
        });   
        

        // Group donations by dropPointId
        const feedbackGroups = {};
        donationsWithDropPoints.forEach(donation => {
            if (!feedbackGroups[donation.dropPoint.id]) {
                feedbackGroups[donation.dropPoint.id] = [];
            }
            feedbackGroups[donation.dropPoint.id].push(donation);
        });

        // Group feedbacks by dropPointId
        const feedbackGroupsByDropPoint = {};
        allFeedbacks.forEach(feedback => {
          if (!feedbackGroupsByDropPoint[feedback.dropPointId]) {
              feedbackGroupsByDropPoint[feedback.dropPointId] = [];
          }
          feedbackGroupsByDropPoint[feedback.dropPointId].push(feedback);
        });
      


        // Map over the drop points and add the "canDonate" flag and "shouldDisplayFeedbackForm" flag
        const dropPoints = dropPointsWithManagers.map(point => {
            const donationsForPoint = feedbackGroups[point.id] || [];
            const feedbackForPoint = feedbackGroupsByDropPoint[point.id] || [];
            
            const averageRating = computeAverageRating(feedbackForPoint);
        
            const pendingDonation = donationsForPoint.find(donation => 
              !["VERIFIED", "ACCEPTEDWITHISSUES", "REJECTED"].includes(donation.status)
            );
    
            // Find donations eligible for feedback, i.e., they don't have feedback yet
            const eligibleForFeedback = donationsForPoint.filter(donation => 
                !feedbackForPoint.find(feedback => feedback.donationId === donation.id)
            );
            return {
              ...point,
              canDonate: !pendingDonation,
              eligibleForFeedback: eligibleForFeedback,  // Updated logic
              shouldDisplayFeedbackForm: eligibleForFeedback.length > 0 && !pendingDonation, // Updated logic
              feedbacks: feedbackForPoint,
              averageRating: averageRating 
            };
        }); 
      

        res.render('organization/dashboard', { dropPoints: dropPoints});
    } catch (error) {
        console.error("Error fetching drop points:", error);
        res.status(500).send("Internal Server Error");
    }
  }, 

  async submitFeedback(req, res) {
    try {
        const { rating, content, donationId, dropPointId } = req.body;
        const organizationId = req.session.organization.id;

        if (!rating || !content || !dropPointId || !donationId) {
            return res.status(400).send("Missing required fields");
        }

        // Create a new feedback record
        await prisma.feedback.create({
            data: {
                content: content,
                rating: parseInt(rating),
                organizationId: organizationId,
                dropPointId: dropPointId,
                donationId: donationId
            }
        });

        // Award 1 point to the organization for submitting the feedback
        const organization = await prisma.organization.findUnique({
            where: {
                id: organizationId
            }
        });

        if (organization) {
            await prisma.organization.update({
                where: {
                    id: organizationId
                },
                data: {
                    totalPoints: organization.totalPoints + 1
                }
            });
        }

        res.redirect('/organization/dashboard'); // Redirect to dashboard or any other page after successful submission
    } catch (error) {
        console.error("Error submitting feedback:", error);
        res.status(500).send("Internal Server Error");
    }
  },

  async getDonationForm(req, res) {
    try {
        const dropPointId = req.body.dropPointId;

        // Fetch the drop point details based on the dropPointId
        const dropPoint = await prisma.dropPoint.findUnique({
            where: {
                id: dropPointId
            }
        });

        if (!dropPoint) {
            return res.status(404).send("Drop point not found");
        } 
        // Render the make-donation page with the drop point data
        res.render('organization/donationForm', { dropPoint });
    } catch (error) {
        console.error("Error fetching drop point:", error);
        res.status(500).send("Internal Server Error");
    }
  },

  async getAddDonation(req, res) {
    try {
        const {
            dropPointId, 
            type, brand, model, condition, quantity 
        } = req.body;

        const organizationId = req.session.organization.id;
        const points = await calculatePoints(type, condition, parseInt(quantity));

        // Find if there's an existing donation that hasn't been submitted yet for the given organization and drop point.
        const existingDonation = await prisma.donation.findFirst({
            where: {
                organizationId: organizationId,
                dropPointId: dropPointId,
                isSubmitted: false
            }
        });

        if (existingDonation) {
            // If the donation already exists, just create the new peripheral under it.
            await prisma.peripheral.create({
                data: {
                    type: type,
                    brand: brand,
                    model: model,
                    condition: condition,
                    quantity: parseInt(quantity),
                    donationId: existingDonation.id
                }
            });

            // Update the points in the existing donation
            await prisma.donation.update({
              where: { id: existingDonation.id },
              data: { points: existingDonation.points + points }
            });
            
        } else {
            // If the donation doesn't exist, create a new one and then create the peripheral under it.
            const newDonation = await prisma.donation.create({
                data: {
                    dropPointId: dropPointId,
                    organizationId: organizationId, 
                    isSubmitted: false,
                    points,
                    peripherals: {
                        create: {
                            type: type,
                            brand: brand,
                            model: model,
                            condition: condition,
                            quantity: parseInt(quantity)
                        }
                    }
                }
            });
        }

        res.redirect('/organization/pledgeBasket');
    } catch (error) {
        console.error("Error adding donation:", error);
        res.status(500).send("Internal Server Error");
    }
  },

  async getPledgeBasketPage(req, res) {
    try {
        const organizationId = req.session.organization.id;

        // Fetch the unsubmitted donations of the organization
        const donations = await prisma.donation.findMany({
            where: {
                organizationId: organizationId,
                isSubmitted: false
            },
            include: {
                dropPoint: true, // Include drop point details
                peripherals: true // Include peripheral details
            }
        }); 

        res.render('organization/pledgeBasket', { donations: donations });
    } catch (error) {
        console.error("Error fetching pledge basket items:", error);
        res.status(500).send("Internal Server Error");
    }
  },

  async getConfirmDonation(req, res) {
    try {
        const { donationId, expectedDateOfArrival } = req.body;

        if (!donationId || !expectedDateOfArrival) {
            return res.status(400).send("Missing required fields");
        }

        // Update the donation record
        await prisma.donation.update({
            where: {
                id: donationId
            },
            data: {
                expectedDateOfArrival: new Date(expectedDateOfArrival),
                isSubmitted: true,
                status: 'PENDING'
            }
        });

        res.redirect('/organization/donationsList');
    } catch (error) {
        console.error("Error confirming donation:", error);
        res.status(500).send("Internal Server Error");
    }
  },

  async postDeleteDonation(req, res) {
    try {
      const donationId = req.params.donationId;
  
      // Delete all peripherals associated with the donation
      await prisma.peripheral.deleteMany({
        where: { donationId: donationId }
      });
  
      // After deleting peripherals, delete the donation
      await prisma.donation.delete({
        where: { id: donationId }
      });
  
      res.redirect('/organization/pledgeBasket');
    } catch (error) {
      console.error("Error deleting donation:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async postUpdatePeripheral(req, res) {
    try {
      const peripheralId = req.params.peripheralId;
      const { condition, quantity } = req.body;
  
      // Fetch the existing peripheral details
      const existingPeripheral = await prisma.peripheral.findUnique({
        where: { id: peripheralId }
      });
  
      if (!existingPeripheral) {
        throw new Error("Peripheral not found");
      }
  
      // Calculate the points for the existing and updated peripheral
      const existingPoints = await calculatePoints(existingPeripheral.type, existingPeripheral.condition, existingPeripheral.quantity);
      const updatedPoints = await calculatePoints(existingPeripheral.type, condition, parseInt(quantity));
  
      // Update the peripheral
      await prisma.peripheral.update({
        where: { id: peripheralId },
        data: { condition: condition, quantity: parseInt(quantity) }
      });
  
      // Calculate the difference in points
      const pointsDifference = updatedPoints - existingPoints;
  
      // Fetch the current total points of the donation
      const donation = await prisma.donation.findUnique({
        where: { id: existingPeripheral.donationId }
      });
  
      if (!donation) {
        throw new Error("Associated donation not found");
      }
  
      // Update the donation's points
      await prisma.donation.update({
        where: { id: existingPeripheral.donationId },
        data: { points: donation.points + pointsDifference }
      });
  
      res.redirect('/organization/pledgeBasket');
    } catch (error) {
      console.error("Error updating peripheral:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async postDeletePeripheral(req, res) {
    try {
      const peripheralId = req.params.peripheralId;
  
      // Fetch the existing peripheral details
      const existingPeripheral = await prisma.peripheral.findUnique({
        where: { id: peripheralId }
      });
  
      if (!existingPeripheral) {
        throw new Error("Peripheral not found");
      }
  
      // Calculate the points for the existing peripheral
      const existingPoints = await calculatePoints(existingPeripheral.type, existingPeripheral.condition, existingPeripheral.quantity);
  
      // Delete the peripheral
      await prisma.peripheral.delete({
        where: { id: peripheralId }
      });
  
      // Check the number of peripherals left in the donation
      const remainingPeripherals = await prisma.peripheral.count({
        where: { donationId: existingPeripheral.donationId }
      });
  
      if (remainingPeripherals === 0) {
        // Option 1: Delete the donation if this was the last peripheral
        await prisma.donation.delete({
          where: { id: existingPeripheral.donationId }
        });
        // Or, Option 2: Update the status of the donation
        // await prisma.donation.update({
        //   where: { id: existingPeripheral.donationId },
        //   data: { status: "Empty" } // or any appropriate status
        // });
      } else {
        // Update the donation's points by subtracting the points of the deleted peripheral
        const donation = await prisma.donation.findUnique({
          where: { id: existingPeripheral.donationId }
        });
  
        if (!donation) {
          throw new Error("Associated donation not found");
        }
  
        await prisma.donation.update({
          where: { id: existingPeripheral.donationId },
          data: { points: donation.points - existingPoints }
        });
      }
  
      res.redirect('/organization/pledgeBasket');
    } catch (error) {
      console.error("Error deleting peripheral:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getDonationsList(req, res) {
    try {
      const organizationId = req.session.organization.id;
      
      // Fetch the donations for the given organization
      const donations = await prisma.donation.findMany({
        where: {
          organizationId: organizationId,
          isSubmitted: true
        },
        include: {
            dropPoint: true, // Include drop point details
            peripherals: true // Include peripheral details
        }
      });
      
      res.render('organization/donationsList', { donations: donations });
    } catch (error) {
      console.error("Error fetching donations:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async postCancelDonation(req, res) {
    try {
      const donationId = req.params.donationId; 
      
      // Delete or update the donation status
      await prisma.donation.update({
        where: { id: donationId },
        data: { isSubmitted: false, status: 'CANCELLED' } // or use delete if you want to completely remove the record
      });
  
      res.redirect('/organization/donationsList'); // Redirect back to the donations list or send a success response
    } catch (error) {
      console.error("Error canceling donation:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getFAQ(req, res) { 
     
    res.render('organization/FAQ'); 
  },

  async getAccount(req, res) { 
    try {
      const organizationId = req.session.organization.id;
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          donations: true,
          advertisements: {
            include: {
              interactions: true
            }
          },
          feedbacksGiven: true
        },
      });
  
      const citiesWithCounts = await getCitiesWithUserCounts();
  
      const donationTrend = await calculateDonationTrend(organization.donations);
      const pointsData = await calculatePointsData(organization.advertisements, organization.donations);
      const donationDistribution = await calculateDonationDistribution(organization.donations);
      const advertisementEngagement = await calculateAdvertisementEngagement(organization.advertisements); 
  
      res.render('organization/account', { 
        organization, 
        donationTrend,
        pointsData,
        donationDistribution,
        advertisementEngagement,
        citiesWithCounts,
        activeTab: req.query.tab || 'account',
        totalDonations: organization.donations ? organization.donations.length : 0,
      }); 
    } catch (error) {
      console.error("Error fetching account data:", error);
      res.status(500).send("Internal Server Error");
    }
  },
  
  async getAdvertisements(req, res) { 
    const organizationId = req.session.organization.id;
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        advertisements: {
          include: {
            interactions: true, // Include the interactions with each advertisement
            city: true, // Include the city information for each advertisement
          },
        },
      },
    }); 
    
    const totalPoints = await getTotalPointsForOrganization(organizationId);  
    
    // Get cities with user counts
    const citiesWithCounts = await getCitiesWithUserCounts();

    res.render('organization/advertisements', { 
      organization, 
      totalPoints, 
      cities: citiesWithCounts, 
      advertisements: organization.advertisements }); 
  }, 

  async getAdvertisementInteractions(req, res) {
    try {
      const adId = req.params.adId;
      const advertisement = await prisma.advertisement.findUnique({
        where: { id: adId },
        include: {
          interactions: true,
        },
      });
  
      if (!advertisement) {
        return res.status(404).send('Advertisement not found');
      }
  
      // Aggregate interactions by date
      const startDate = advertisement.startDate;
      const endDate = advertisement.expiryDate;
      let date = new Date(startDate);
      const interactionsByDate = {};
  
      while (date <= endDate) {
        interactionsByDate[date.toISOString().split('T')[0]] = 0;
        date.setDate(date.getDate() + 1);
      }
  
      advertisement.interactions.forEach(interaction => {
        const interactionDate = interaction.clickedAt.toISOString().split('T')[0];
        if (interactionDate in interactionsByDate) {
          interactionsByDate[interactionDate]++;
        }
      });
  
      res.json(interactionsByDate);
    } catch (error) {
      console.error('Error fetching interactions:', error);
      res.status(500).send('Error fetching interactions');
    }
  },
   
  async getAdCity(req, res) { 
    const cityId = req.params.cityId;
  
    // Fetch city details by ID along with its related advertisements
    const city = await prisma.city.findUnique({
      where: { id: cityId },
      include: { 
        advertisements: {
          orderBy: {
            startDate: "desc" // Get the latest advertisements first
          }
        } 
      }
    });
  
    if (!city) {
      // City not found
      return res.status(404).send('City not found');
    }
  
    // Render the form for advertising in the chosen city
    res.render('organization/adCity', { city }); 
  }, 

  async submitAdvertisement(req, res) {
    try {
        const { title, link, adPlan, cityId } = req.body;
        const organizationId = req.session.organization.id;

        const organization = await prisma.organization.findUnique({ where: { id: organizationId } });

        // Deduct points based on the adPlan chosen
        let pointsSpent = adPlan === "basic" ? 10 : 20;

        // Validate if the organization has enough points
        if (organization.totalPoints < pointsSpent) {
            return res.status(400).send("Insufficient points to create this advertisement.");
        }

        // Determine the duration of the advertisement based on the plan
        let duration = adPlan === "basic" ? 7 : 14;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + duration);

        // Check if an image file was uploaded
        let imageUrl = '';  // Initializing imageUrl as an empty string
        if (req.file) {
            // Compress and resize the image using sharp
            const compressedImageBuffer = await sharp(req.file.buffer)
                .resize(800) // Width of 800px
                .jpeg({ quality: 70 }) 
                .toBuffer();

            // Convert it to a base64 string to save as URL
            // imageUrl = `data:image/jpeg;base64,${compressedImageBuffer.toString('base64')}`;
            imageUrl = compressedImageBuffer;

        }

        // Create the advertisement with the processed imageUrl
        await prisma.advertisement.create({
            data: {
                title, 
                pointsSpent,
                link,
                imageUrl,  // Use the processed imageUrl here
                isActive: true,
                startDate: new Date(),
                expiryDate,
                organization: { connect: { id: organizationId } },
                city: { connect: { id: cityId } },
            }
        });

        // Deduct the points from the organization's total points
        await prisma.organization.update({
            where: { id: organizationId },
            data: { totalPoints: organization.totalPoints - pointsSpent }
        });

        res.redirect('/organization/account'); // Redirect to the success page

    } catch (error) {
        console.error("Error creating advertisement:", error);
        res.status(500).send("Internal Server Error");
    }
  },

  logout(req, res) {
    // Clear the session to log out the user
    req.session.organization = null;
    res.redirect('/');
  },
};
