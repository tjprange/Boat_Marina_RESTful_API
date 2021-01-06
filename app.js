const express = require("express");
const app = express();
const data = require("./data");

const jwt_decode = require("jwt-decode");

app.enable("trust proxy");

app.use("/", require("./api/index"));

const axios = require("axios");

const CLIENT_ID = data.CLIENT_ID;
const REDIRECT = "";
const CLIENT_SECRET = data.CLIENT_SECRET;
//const DOMAIN = 'http://localhost:8080';
const DOMAIN = "https://cs473final.wn.r.appspot.com";

/* ------------- Begin Controller Functions ------------- */

// Intro route
app.get("/", function (req, res) {
  link =
    "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=" +
    CLIENT_ID +
    "&redirect_uri=" +
    DOMAIN +
    "/oauth&scope=profile&email";
  res.send({
    Welcome: "CS 473 Final Project",
    Link: link,
  });
});

// Redirect here after OAUTH
app.get("/oauth", (req, res) => {
  code = req.query.code;
  axios
    .post("https://www.googleapis.com/oauth2/v4/token", {
      code: code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: DOMAIN + "/oauth",
      grant_type: "authorization_code",
    })
    .then((resp) => {
      var decoded = jwt_decode(resp.data.id_token);
      //console.log(decoded);
      res.send({
        Welcome: decoded.name,
        token: resp.data.id_token,
        Sub: decoded.sub,
      });
    })
    .catch((error) => {
      console.error(error);
    });
});

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  //console.log(`Server listening on port ${PORT}...`);
  console.log(`http://localhost:${PORT + "/"}`);
});
