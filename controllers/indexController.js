require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const otpGenerator = require('otp-generator');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
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
  async loginUser(req, res) {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        return res.render('login', { message: 'Invalid email or password.' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        return res.render('login', { message: 'Invalid email or password.' });
      }

      // Set user session after successful login
      req.session.user = user;

      // Redirect to the user dashboard
      res.redirect('/user/dashboard');
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred' });
    }
  },
};
