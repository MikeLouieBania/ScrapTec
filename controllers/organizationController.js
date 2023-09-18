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

  async addDonation(req, res) {
    try {
        const {
            dropPointId, expectedDateOfArrival, 
            type, brand, model, condition, quantity 
        } = req.body;

        const organizationId = req.session.organization.id;

        // Check if there's an existing donation with status 'Pending' to the same drop point
        const existingDonation = await prisma.donation.findFirst({
            where: {
                organizationId: organizationId,
                dropPointId: dropPointId,
                status: "Pending"
            }
        });

        if (existingDonation) {
            return res.status(400).send("You have an existing pending donation to this drop point. Please wait for it to be verified.");
        }

        // Create a new donation record with isSubmitted set to false
        const newDonation = await prisma.donation.create({
            data: {
                dropPointId: dropPointId,
                organizationId: organizationId,
                expectedDateOfArrival: new Date(expectedDateOfArrival),
                status: "Pending",
                isSubmitted: false,
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

        res.redirect('/pledgeBasket');
    } catch (error) {
        console.error("Error adding donation:", error);
        res.status(500).send("Internal Server Error");
    }
  },

  async getPledgeBasketPage(req, res) {
    try {  
        res.render('organization/pledgeBasket');
    } catch (error) {
        console.error("Error fetching drop point:", error);
        res.status(500).send("Internal Server Error");
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
