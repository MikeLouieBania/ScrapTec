const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); 

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
      conditionPoints += 1;
    } else if (condition === 'Used but Working') {
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

module.exports = {
  async getDashboard(req, res) {
    try {
        const organizationId = req.session.organizationId;

        const dropPointsRaw = await prisma.dropPoint.findMany({
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

        // Now, for each drop point, check if the organization has a submitted donation
        const dropPoints = await Promise.all(dropPointsRaw.map(async (point) => {
            const hasPendingDonation = await prisma.donation.findFirst({
                where: {
                    organizationId: organizationId,
                    dropPointId: point.id,
                    isSubmitted: true
                }
            });

            return {
                ...point,
                canDonate: !hasPendingDonation
            };
        }));
        
        res.render('organization/dashboard', { dropPoints: dropPoints });
    } catch (error) {
        console.error("Error fetching drop points:", error);
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
  
  async getDonationPointInfoPage(req, res) { 
     
    res.render('organization/donationPointInfo'); 
  },
  async getAccount(req, res) { 
    const organizationId = req.session.organization.id;
    const organization = await prisma.organization.findUnique({
      where: {id: organizationId},
    });
    res.render('organization/account', { organization }); 
  },
     
  logout(req, res) {
    // Clear the session to log out the user
    req.session.organization = null;
    res.redirect('/');
  },
};
