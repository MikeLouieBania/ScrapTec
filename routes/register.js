var express = require('express');
var router = express.Router();
const validator = require('email-validator');

const {PrismaClient, Prisma} = require("@prisma/client")
var prisma = new PrismaClient

function encrypt(text, shift) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    let char = text.charAt(i);
    // Check if character is a letter
    if (/[a-zA-Z]/.test(char)) {
      let code = text.charCodeAt(i);
      // Uppercase letters
      if (code >= 65 && code <= 90) {
        char = String.fromCharCode(((code - 65 + shift) % 26) + 65);
      }
      // Lowercase letters
      else if (code >= 97 && code <= 122) {
        char = String.fromCharCode(((code - 97 + shift) % 26) + 97);
      }
    }
    // Check if character is a number or special character
    else if (/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(char)) {
      let code = text.charCodeAt(i);
      char = String.fromCharCode((code + shift) % 128);
    }
    result += char;
  }
  return result;
}

/* GET home page. */
router.get('/register', async function(req, res, next) {
  var users = await prisma.User.findMany()

  res.render('register', { title: 'Express', users: users }); 
});

router.post('/register', async (req, res) => {
  const { email, password, usertype } = req.body;

  if (!validator.validate(email)) {
    return res.render('register', { message: 'Invalid email address' });
  }

  const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.render('register', { message: 'Password must be: 8 characters minimum, at least one number, one lowercase letter, one uppercase letter, and one special character' });
  }

  const encryptedPassword = encrypt(password,3);
  const user = await prisma.User.findUnique({ where: { email } });
  
  if (user) {
   return res.render('register', { errorMessage: `Email already exists, please choose a different one`});
  } else {
    await prisma.User.create({
      data: {
        email,
        password: encryptedPassword,
        usertype
      }
    });
    return res.redirect('/login');
  }
});

module.exports = router;
