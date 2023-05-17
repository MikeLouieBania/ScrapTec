const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET route for rendering the student info form
router.get('/studentinfo', function(req, res) {
  res.render('studentinfo');
});

// POST route for submitting the student info form
router.post('/studentinfo', async function(req, res) {
  try {
    // Check if the user is logged in
    if (!req.session.userId) {
      return res.redirect('/');
    }

    // Create the student info record
    const studentInfo = await prisma.student_Info.create({
      data: {
        userId: req.session.userId,
        lastname: req.body.lastname,
        firstname: req.body.firstname,
        middlename: req.body.middlename,
        address: req.body.address,
        city: req.body.city,
        region: req.body.region,
        zipcode:req.body.zipcode,
        birthdate: new Date(req.body.birthdate),
        gender: req.body.gender,
        civil_status: req.body.civil_status,
        hobby: req.body.hobby
      }
    });

    res.redirect('/studentinfo');
  } catch (error) {
    console.error(error);
    res.render('studentinfo', { title: 'Student Information', error: error.message });
  }
});

// GET route for viewing the student information
router.get('/studentinfo', async function(req, res) {
  try {
    // Check if the user is logged in
    if (!req.session.userId) {
      return res.redirect('/');
    }

    // Fetch the student info for the logged-in user
    const studentInfo = await prisma.studentInfo.findUnique({
      where: {
        userId: req.session.userId
      }
    });
    
    res.render('viewinfo', { title: 'View/Edit Student Information', studentInfo });
  } catch (error) {
    console.error(error);
    res.render('viewinfo', { title: 'View/Edit Student Information', error: error.message });
  }
});

// POST route for editing the student info form
router.post('/studentinfo', async function(req, res, next) {
  try {
    const userId = req.session.userId;
    const { lastname, firstname, middlename, address, city, region, country, zipcode, birthdate, gender, civil_status, hobby } = req.body;

    // Update the student info record
    const studentInfo = await prisma.studentInfo.update({
      where: { userId },
      data: {
        lastname,
        firstname,
        middlename,
        address,
        city,
        region,
        zipcode,
        birthdate: new Date(birthdate),
        gender,
        civilStatus: civil_status,
        hobby: hobby ? hobby : []
      }
    });

    console.log(studentInfo);
    res.redirect('/studentinfo');
  } catch (err) {
    console.log(err);
    res.render('error', { errorMessage: 'Error updating student information.' });
  }
});

module.exports = router;
