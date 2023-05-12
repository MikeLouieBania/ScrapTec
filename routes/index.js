var express = require('express');
var router = express.Router();
const session = require('express-session');
const app = express();
app.use(express.json());

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
router.get('/login', async function(req, res, next) {
  var users = await prisma.User.findMany()

  res.render('index', { title: 'Express', users: users });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  const encryptedPassword = encrypt(password, 3);
  
  try {
    const user = await prisma.User.findUnique({
      where: { email: email },
    });

    if (!user) {
      res.render('index', { errorMessage: `Incorrect Email / Password.` });
    } else {
        if(encryptedPassword == user.password){
          const userId = user.id;
          session.userId = userId;
          res.redirect('/user');
        } else {
          res.render('index', { errorMessage: `Incorrect Password. ` });
        }
    }
  } catch (err) {
    console.log(err);
    res.render('index', { errorMessage: `Something went wrong.` });
  }
});

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
}));

router.get('/logout', async (req, res) => {  
  try {
    const userId = null;
    delete session.userId;
    res.redirect('/index');
  } catch (err) {
    console.log(userId);
    res.status(500).send('Internal server error');
  }
});

module.exports = router;
