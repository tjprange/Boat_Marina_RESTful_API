const express = require('express');
const app = express();

const bodyParser = require('body-parser');
const router = express.Router();

const ds = require('./datastore');

const datastore = ds.datastore;

const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');

router.use(bodyParser.json());
app.use('/users', router);

const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: "https://www.googleapis.com/oauth2/v3/certs"
    }),

    // Validate the audience and the issuer.
    issuer: "https://accounts.google.com",
    algorithms: ['RS256']
});

const USER = 'User';

/* ------------- Begin User Model Functions ------------- */


// will create a new user and return it's data
function post_user(name, sub) {
    var key = datastore.key(USER);
    const new_user = { "name": name, "sub": sub };
    return datastore.save({ "key": key, "data": new_user }).then(() => { return key })
}

// get ALL users
function get_users_unprotected() {
    const q = datastore.createQuery(USER);
    return datastore.runQuery(q).then((entities) => {
        return entities[0].map(ds.fromDatastore);
    })
}

/* ------------- End Model Functions ------------- */


/* ------------- Begin Controller Functions ------------- */

// Add a new authenticated user to the DB
router.post('/', checkJwt, function (req, res) {
    const accepts = req.accepts(['application/json', 'text/html']);
    if (!accepts) { // bad media
        res.status(406).send({ "Error": 'Invalid Media Type' });
    } else {
        post_user(req.user.name, req.user.sub)
            .then(key => {
                res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + key.id);
                res.status(201).send({
                    "name": req.user.name,
                    "sub": req.user.sub,
                    "user_id": key.id
                })
            });
    }
});

// get all users in the db
router.get('/', function (req, res) {
    const users = get_users_unprotected()
        .then((users) => {
            res.status(200).send(users);
        })
})

/* ------------- End Controller Functions ------------- */



// ROUTE FOR BAD OR MISSING JWT
router.use('/', function (err, req, res, next) {
    if (err.name === 'UnauthorizedError') {
        res.status(401).send({ 'Error': 'invalid token...' });
    } else {
        console.error(err.stack)
        res.status(500).send('Something broke!')
    }
})

module.exports = router;