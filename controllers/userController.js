const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const sharp = require('sharp');

module.exports = {
  async getDashboard(req, res) { 
    try {
        const dropPoints = await prisma.dropPoint.findMany({
          where: {
            NOT: {
              managerId: null
            }
          },
          include: {
              manager: true
          }
        });
        res.render('user/dashboard', { user: req.session.user, dropPoints });
    } catch(error) {
        console.error("Error fetching drop points:", error);
        res.status(500).send("Internal Server Error");
    }
  },
  
  async getMarketplace(req, res) { 
    res.render('user/marketplace', { user: req.session.user });
  }, 
  
  async getAccount(req, res) { 
    const userId = req.session.user.id;
    const user = await prisma.user.findUnique({
      where: {id: userId},
    });
    res.render('user/useraccount', { user }); 
  },

  async getDonations(req, res) {
    try {
      const userDonations = await prisma.donation.findMany({
        where: {
          userId: req.session.user.id,
        },
        include: {
          images: true,
        },
      });
  
      res.render('user/userdonations', { 
        user: req.session.user,
        donations: userDonations 
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
    req.session.user = null;
    res.redirect('/');
  },
};
