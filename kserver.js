const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cors = require('cors');

//bcrypt
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sys = require('sys');
const requestIp = require('request-ip');
const iconv = require('iconv-lite');
const multer = require('multer');
const fs = require('fs'); //폴더 생성할때
const axios = require('axios');

// const PopList = require('./PopList');
// const PostList = require('./PostList');
// const User = require('./User');
// const CalendarEvent = require('./CalendarEvent');
// const PopSystemList = require('./PopSystemList');
// const IpaddrList = require('./IpaddrList');



const app = express();

app.use(cors());

//mongoose.connect('mongodb+srv://kumhoktg:kumhoktg@cktgdb0.uzmnp.mongodb.net/cktgdb0?retryWrites=true&w=majority');
//mongoose.connect('mongodb://kumho:kumho@165.141.33.82:27017/cktgdb0');
//mongodb+srv://winaki:ghwnsl0705$$@cluster0.vzxwykq.mongodb.net/winaki802?retryWrites=true&w=majority
//cluster0.vzxwykq.mongodb.net

mongoose
  .connect('mongodb+srv://winaki:ghwnsl0705$$@cluster0.vzxwykq.mongodb.net/winaki802?retryWrites=true&w=majority', {
      readPreference: 'primary',
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
  })
  .then(() => {
    console.log('Connected to Database');
  })
  .catch((err) => {
    console.log('Not Connected to Database ERROR! ', err);
  });

  // ✅ Mongoose 모델 정의
const kakaomsgthumnailSchema = new mongoose.Schema({
  mid: String,
  title: String,
  description: String,
  image: String,
  url: String,
  updateAt: Date,  
});

const kakaoMsgAl = mongoose.model("kakaomsgthumnail", kakaomsgthumnailSchema);

// ✅ User-Agent 판별 함수
function isCrawler(ua) {
  return /KAKAOTALK|facebookexternalhit|Slackbot|Twitterbot|Discordbot|LinkedInBot/i.test(
    ua
  );
}


app.get('/', (req, res, next) => {
  res.send('send winaki3 from server4');
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


// ✅ 헬스 체크용 라우트 (Render Keep-Alive)
app.get('/health', (req, res) => {

  res.status(200).json({
    status : 'ok',
    message : 'Server is alive',
    time: new Date(),
  });
});

function keepAlive() {

  setInterval(async () => {
    try {
      await axios.get('https://km.onrender.com/health');
      console.log('keep alive ping send');
    } catch (err) {
      console.error('keep alive ping failed', err.message);
    }
  }, 10*60*1000);
}

keepAlive();

// ✅ 라우트
app.get("/p/:id", async (req, res) => {
  const {id} = req.params;
  const ua = req.headers["user-agent"];
  
  console.log('id:', id);
  console.log('ua:', ua);


  try {


    //const km = await kakaoMsgAl.findOne({mid : id})
    const data = await kakaoMsgAl.findOne({ mid: id }).lean();

    if(!km) {
      return res.status(404).send("kakao message Not Found ");
    }

     // 🟦 1) 카카오톡/페북 서버 요청 → OG 메타태그 HTML 응답
     if (isCrawler(ua)) {
      const html = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="utf-8" />
          <meta property="og:title" content="${km.title}"/>
          <meta property="og:description" content="${km.description}"/>
          <meta property="og:image" content="${km.image}" />
          <meta property="og:url" content="${km.url}" />
          <meta property="og:type" content="website"/>
          <title>${km.title}</title>
        </head>
        <body>
          <p> OG meta generated from MonoDB </p>
        </body>        
        </html>
      `;
      return res.send(html);
     }

     // 일반 사용자 브라우저 접근 시 -> 실제 페이지로 이동
     //res.redirect(km.url);
     console.log('redirect:', km.url);
     
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Internal Server Error");
  }
});


//routes
app.post('/signin', (req, res, next) => {
  const newUser = new User({
    userid: req.body.userid,
    name: req.body.name,
    dept: req.body.dept,
    email: req.body.email,
    password: bcrypt.hashSync(req.body.password, 10)
  });
  //console.log(req.body)
  //console.log(newUser)

  newUser.save((err) => {
    if (err) {
      //console.log(err)
      return res.status(400).json({
        title: 'error',
        error: 'email in user'
      });
    }
    return res.status(200).json({
      title: 'signin success'
    });
  });
});

app.post('/signin3', (req, res, next) => {
  const newUser = new User({
    userid: req.body.email.split('@')[0],
    name: req.body.name,
    email: req.body.email,
    password: bcrypt.hashSync(req.body.password, 10)
  });

  console.log(req.body);
  console.log(newUser);

  newUser
    .save()
    .then(() => {
      return res.status(200).json({ title: 'signin success' });
    })
    .catch((error) => {
      return res.status(400).json({
        title: 'error',
        error: error
      });
    });
});

app.post('/login', (req, res, next) => {
  //User.findOne({ userid: req.body.userid }, (err, user) => {

  User.findOne({ email: req.body.email })
    .limit(10)
    .then((user) => {
      if (!user) {
        return res.status(401).json({
          title: 'user not found',
          error: 'invalid credentials'
        });
      }

      //incorrect password
      if (!bcrypt.compareSync(req.body.password, user.password)) {
        return res.status(401).json({
          title: 'login failed',
          error: 'invalid credentials'
        });
      }
      //if all is good create a token and send to frontend
      let token = jwt.sign({ userId: user._id }, 'secretkey');
      return res.status(200).json({
        title: 'login success',
        userid: user.userid,
        name: user.name,
        email: user.email,
        dept: user.dept,
        token: token,
        ipaddress: requestIp.getClientIp(req)
      });
    })
    .catch((error) => {
      if (err)
        return res.status(500).json({
          title: 'server error',
          error: err
        });
    });
  //console.log(req.body)
});

app.get('/user', (req, res, next) => {
  let token = req.headers.token;
  //console.log(req.headers);

  jwt.verify(token, 'secretkey', (err, decoded) => {
    if (err)
      return res.status(401).json({
        title: 'unauthorized'
      });
    //console.log(decoded);
    //token  is valid
    User.findOne({ _id: decoded.userId }).then((user) => {
      return res.status(200).json({
        title: 'user grabbed',
        user: {
          userid: user.userid,
          name: user.name,
          email: user.email,
          dept: user.dept
        }
      });
    });
  });
});

app.post('/userinfo', (req, res, next) => {
  //let token = req.headers.token;

  if (req.body.userid !== '') {
    User.findOne({ userid: req.body.userid }, (err, user) => {
      if (err)
        return res.status(500).json({
          title: 'server error',
          error: err
        });
      if (!user) {
        return res.status(401).json({
          title: 'user not found',
          error: 'invalid credentials'
        });
      }

      //if all is good create a token and send to frontend

      return res.status(200).json({
        title: 'login success',

        userid: user.userid,
        name: user.name,
        email: user.email,
        dept: user.dept
      });
    });
  } else if (req.body.name !== '') {
    User.findOne({ name: req.body.name }, (err, user) => {
      if (err)
        return res.status(500).json({
          title: 'server error',
          error: err
        });
      if (!user) {
        return res.status(401).json({
          title: 'user not found',
          error: 'invalid credentials'
        });
      }

      //if all is good create a token and send to frontend

      return res.status(200).json({
        title: 'login success',

        userid: user.userid,
        name: user.name,
        email: user.email,
        dept: user.dept
      });
    });
  }
});


const port = process.env.PORT || 3003;

app.listen(port, (err) => {
  if (err) return console.log(err);
  console.log(`OG Proxy Server running at ${port}`);
});
