const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); 

module.exports = {
  async getDashboard(req, res) {
    try {
      const dropPoints = await prisma.dropPoint.findMany({
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
        },
        // take: 20, // or whatever number you feel suitable
        // skip: (req.query.page || 0) * 20 // assuming you pass the page number in the query string
      });
      
      res.render('organization/dashboard', { dropPoints: dropPoints });
    } catch (error) {
      console.error("Error fetching drop points:", error);
      res.status(500).send("Internal Server Error");
    }
  },
  
  async getDonationPage(req, res) {
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
        res.render('organization/make-donation', { dropPoint });
    } catch (error) {
        console.error("Error fetching drop point:", error);
        res.status(500).send("Internal Server Error");
    }
  },

  async submitDonationForm(req, res) {
    try {
        const {
            dropPointId, brand, model, processor, ramSize, storage, graphicsCard, condition, pcQuantity,
            type, // this will be an array
            // ... and so on for peripherals ...
        } = req.body;

        const organizationId = req.session.organization.id;

        // Create a new donation record
        const donation = await prisma.donation.create({
            data: {
                organizationId: organizationId,
                dropPointId: dropPointId,
                status: "Pending" // This can be changed later on
            }
        });

        if (donation) {
            // Create a new complete PC system record
            if (brand && model) { // Add more conditions as needed to check if PC details are filled
                await prisma.completePCSystem.create({
                    data: {
                        brand,
                        model,
                        processor,
                        ramSize: parseInt(ramSize),
                        storage,
                        graphicCard: graphicsCard,
                        condition,
                        quantity: parseInt(pcQuantity),
                        donationId: donation.id
                    }
                });
            }

            // Create new peripheral/component records
            if (type && type.length > 0) {
                const peripheralsData = type.map((_, index) => ({
                    type: type[index],
                    brand: req.body.brand[index],
                    model: req.body.model[index],
                    condition: req.body.condition[index],
                    quantity: parseInt(req.body.peripheralQuantity[index]),
                    donationId: donation.id
                }));

                await prisma.peripheralOrComponent.createMany({
                    data: peripheralsData
                });
            }

            res.redirect('/organization/donations');
        } else {
            throw new Error('Error creating the donation record.');
        }

    } catch (error) {
        console.error("Error processing donation form:", error);
        res.status(500).send('An error occurred while processing your donation.');
    }
  },

  async getAccount(req, res) { 
    const organizationId = req.session.organization.id;
    const organization = await prisma.organization.findUnique({
      where: {id: organizationId},
    });
    res.render('organization/account', { organization }); 
  },

  async getDonations(req, res) {
    try { 
      const donations = await prisma.donation.findMany({
        where: {
          organizationId: req.session.organization.id  // Assuming you have the organizationId in your session or some auth middleware
        },
        include: {
          completeSystems: true  // This fetches the related PC Systems for each donation
        }
      });
  
      res.render('organization/donations', { donations });  // Send the fetched donations to the view
    } catch (error) {
      console.error("Error fetching donations:", error);
      res.status(500).send("Internal server error");
    }
  },
     
  logout(req, res) {
    // Clear the session to log out the user
    req.session.organization = null;
    res.redirect('/');
  },
};
