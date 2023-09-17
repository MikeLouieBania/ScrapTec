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
 
  
  async getMakeDonations(req, res) {
    res.render('organization/make-donation'); 
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
      const organizationDonations = await prisma.donation.findMany({
        where: {
          organizationId: req.session.organization.id,
        },
        include: {
          images: true,
        },
      });
  
      res.render('organization/donations', { 
        organization: req.session.organization,
        donations: organizationDonations 
      });
    } catch (error) {
      console.error("Error fetching donations:", error);
      res.status(500).send("Internal server error");
    }
  },

  async submitDonation(req, res) {
    try {
      const { pcBrand, pcModel, processor, ramSize, storage, graphicCard, condition, quantity, expectedDateOfArrival, dropPointId } = req.body;
      const images = req.files;
  
      if (images && images.length > 3) {
        return res.status(400).send('You can upload a maximum of 3 images.');
      }
  
      let imageDatas = [];
      for (let image of images) {
        // Convert images to webp format
        const outputPath = image.path + '.webp';
        await sharp(image.path).toFile(outputPath);
  
        // Read the converted image as bytes
        const imageData = fs.readFileSync(outputPath);
        imageDatas.push({ imageData });
  
        // Optionally, delete the temp image file after reading its content
        fs.unlinkSync(image.path);
        fs.unlinkSync(outputPath);
      }
  
      // Insert into database using prisma
      const donation = await prisma.donation.create({
        data: {
          pcBrand,
          pcModel,
          processor,
          ramSize: parseInt(ramSize),
          storage,
          graphicCard,
          condition,
          quantity: parseInt(quantity),
          expectedDateOfArrival: new Date(expectedDateOfArrival),
          user: {
            connect: {
              id: req.session.user.id
            }
          },
          dropPoint: {
            connect: {
              id: dropPointId
            }
          },
          images: {
            create: imageDatas
          }
        }
      });
  
      res.redirect('/user/userdonations');
    } catch (error) {
      console.error("Error submitting donation:", error);
      res.status(500).send('An error occurred while processing your donation.');
    }
  }, 
     
  logout(req, res) {
    // Clear the session to log out the user
    req.session.organization = null;
    res.redirect('/');
  },
};
