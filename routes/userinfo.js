const express = require('express');
const router = express.Router();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware to retrieve the student information based on the user's ID
async function fetchStudentInfo(req, res, next) {
  try {
    const userId = req.query.id; // Retrieve the user's ID from the query parameter

    // Fetch the student information from MongoDB based on the user's ID
    const studentInfo = await prisma.student_Info.findFirst({ where: { userId } });

    if (!studentInfo) {
      // Handle the case where student information is not found
      return res.status(404).send('Information not found');
    }

    // Attach the retrieved studentInfo to the request object for use in subsequent middleware or route handlers
    req.studentInfo = studentInfo;
    next();
  } catch (error) {
    console.error('Error retrieving information:', error);
    res.status(500).send('Internal Server Error');
  }
}

router.get('/adminUserTable', async (req, res) => {
  const users = await prisma.user.findMany();
  res.render('adminUserTable', { title: 'User Info', users });
});

// Route handler for /view
router.get('/view', fetchStudentInfo, (req, res) => {
  // Render the "view" page using the retrieved studentInfo data
  res.render('view', { title: 'Student Info', student: req.studentInfo });
});

// Route handler for /edit
router.get('/edit', fetchStudentInfo, (req, res) => {
  // Render the "edit" page using the retrieved studentInfo data
  res.render('edit', { title: 'Edit Info', student: req.studentInfo });
});

router.post('/edit/:id', (req, res) => {
  // Extract the updated information from the request body
  const updatedStudent = {
    address: req.body.address,
    city: req.body.city,
    region: req.body.region,
    zipcode: req.body.zipcode,
    civil_status: req.body.civil_status
  };

  const userId = req.params.id; // Retrieve the user's ID from the URL parameter

  // Update the student's information in the database
  prisma.student_Info
  .update({
    where: { userId: userId }, // Make sure the userId field is correct and matches an existing record
    data: updatedStudent,
  })
  .then(updatedStudent => {
    // Redirect to a success page 
    res.redirect('/adminUserTable');
  })
  .catch(error => {
    // Handle the error
    console.error('Error updating information:', error);
    res.status(500).json({ error: 'An error occurred while updating the information' });
  });
});
module.exports = router;