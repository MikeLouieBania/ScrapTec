require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const otpGenerator = require('otp-generator');
const nodemailer = require('nodemailer');
const fs = require('fs');  
const authMiddleware = require('./authMiddlewareUser');

module.exports = {
  async getIndex(req, res) {  
    res.render('index');
  }, 
  async getLogin(req, res) {  
    res.render('login');
  }, 
  async getSignup(req, res) {  
    res.render('signup');
  }, 
  async registerUser(req, res) {
    try {
      const { firstName, lastName, email, password, city, gender, contactNumber } = req.body;

      const otp = otpGenerator.generate(6, { digits: true, upperCase: false, specialChars: false }); // Generate OTP
 
      const hashedPassword = await bcrypt.hash(password, 10);

      const profilePicture = req.file ? req.file.buffer.toString('base64') : null;
      
      // Store the OTP and registration data temporarily in a session or cache
      req.session.registrationData = {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        city,
        gender,
        contactNumber,
        otp,
        profilePicture,
      };

      // Send OTP to user's email
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_USERNAME,
        to: email,
        subject: 'OTP Verification',
        text: `Your OTP for email verification is: ${otp}`
      };

      await transporter.sendMail(mailOptions);

      res.render('verify-otp', { message: 'An OTP has been sent to your email. Enter it below.' });
    
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred' });
    }
  },
  async verifyOTP(req, res) {
    const { otp } = req.body;

    // Retrieve stored registration data from session or cache
    const registrationData = req.session.registrationData;

    if (!registrationData || registrationData.otp !== otp) {
      return res.render('verify-otp', { message: 'Invalid OTP. Enter the correct OTP or try again.' });
    }

    const hashedPassword = registrationData.password;

    try {
      // Create the user in the database
      const newUser = await prisma.user.create({
        data: {
          firstName: registrationData.firstName,
          lastName: registrationData.lastName,
          email: registrationData.email,
          password: hashedPassword,
          city: registrationData.city,
          gender: registrationData.gender,
          contactNumber: registrationData.contactNumber,
          profilePicture: registrationData.profilePicture ? Buffer.from(registrationData.profilePicture, 'base64') : null,
        }
      });

      // Clear the stored registration data
      delete req.session.registrationData;

      res.render('login', { message: 'User registered successfully. You can now log in.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred' });
    }
  },
  async getVerifyOTP(req, res) {
    res.render('verify-otp', { message: 'Enter the OTP you received in your email.' });
  },
  async registerOrganization(req, res) {
    try {
      const {
        organizationname,
        email,
        address,
        contactNumber,
        secRegistrationNumber,
        type,
        password,
      } = req.body;

      
      const hashedPassword = await bcrypt.hash(password, 10);

      
      const profilePicture = req.files.profilePicture ? req.files.profilePicture[0].buffer.toString('base64') : null;
      const documentUpload = req.files.documentUpload ? req.files.documentUpload[0] : null;


      const uniqueFilename = `${Date.now()}-${documentUpload.originalname}`;
      const base64Content = documentUpload.buffer.toString('base64');
      const uniqueUrl = `data:${documentUpload.mimetype};base64,${base64Content}`;


  
      // Create a new organization in the database along with associated documents
      const newOrganization = await prisma.organization.create({
        data: {
          organizationname,
          email,
          address,
          contactNumber,
          secRegistrationNumber,
          type,
          password: hashedPassword,
          submittedDocuments: {
            create: [
              {
                filename: documentUpload.originalname,
                url: uniqueUrl, // Store the document content as base64
                uploadedBy: organizationname, // Update with actual identifier
              },
            ],
          },
          profilePicture,
        },
      });

      // Setup email data with unicode symbols
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USERNAME, // Sender address
        to: email, // List of receivers
        subject: "Your Organization Registration", // Subject line
        html: `<h1>Welcome ${organizationname}</h1>
        <p>Thank you for registering your organization with us. Your registration is currently <b>pending</b>.</p>
        <p>We will verify your submitted documents and assess your organization's credibility. This process may take some time.</p>
        <p>We will send you another email once the registration status is updated.</p>
        <p>Best regards,</p>
        <p>Your Team</p>`
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Email could not be sent:", error);
        } else {
          console.log("Email sent:", info.response);
        }
      });
    
      // Redirect to a success page or take any other necessary actions
      res.render('login', { message: 'Organization registered successfully.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred' });
    }
  },
  async login(req, res) {
    try {
      const { email, password } = req.body;
  
      // Check if the user exists
      const user = await prisma.user.findUnique({
        where: { email },
      });
  
      // Check if the organization exists
      const organization = await prisma.organization.findUnique({
        where: { email },
      });
  
      if (!user && !organization) {
        return res.render('login', { message: 'Invalid email or password.' });
      }
  
      if (user) {
        // User login
        const passwordMatch = await bcrypt.compare(password, user.password);
  
        if (!passwordMatch) {
          return res.render('login', { message: 'Invalid email or password.' });
        }
  
        // Set user session after successful login
        req.session.user = user;
  
        // Redirect to the user dashboard
        return res.redirect('/user/dashboard');
      }
  
      if (organization) {
        // Organization login
        if (organization.verificationStatus === 'APPROVED') {
          const passwordMatch = await bcrypt.compare(password, organization.password);
  
          if (!passwordMatch) {
            return res.render('login', { message: 'Invalid email or password.' });
          }
  
          // Set organization session after successful login
          req.session.organization = organization;
  
          // Redirect to the organization dashboard
          return res.redirect('/organization/dashboard');
        } else if (organization.verificationStatus === 'PENDING') {
          return res.render('login', { message: 'Your organization is pending approval.' });
        } else {
          return res.render('login', { message: 'Your organization has been rejected.' });
        }
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred' });
    }
  },  
};
