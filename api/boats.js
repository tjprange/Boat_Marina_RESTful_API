const express = require("express");
const app = express();

const bodyParser = require("body-parser");
const router = express.Router();

const ds = require("./datastore");

const datastore = ds.datastore;

const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");

router.use(bodyParser.json());

// middleware for validating jwt
const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
  }),

  // Validate the audience and the issuer.
  issuer: "https://accounts.google.com",
  algorithms: ["RS256"],
});

const BOAT = "Boat";
const LOAD = "Load";

// This function will generate a URL provided the function args
function makeUrl(protocol, host, resource, id) {
  return protocol + "://" + host + resource + id;
}

// Helper function returns an item of specified kind from the db
async function get_item_by_id(id, KIND) {
  const key = datastore.key([KIND, parseInt(id, 10)]);
  const [item] = await datastore.get(key);
  return item;
}

/* ------------- Begin boat Model Functions ------------- */

// return all boats in the db
function get_boats_unprotected(req) {
  var q = datastore.createQuery(BOAT).limit(5);
  const results = {};
  var prev;
  if (Object.keys(req.query).includes("cursor")) {
    prev =
      req.protocol +
      "://" +
      req.get("host") +
      req.baseUrl +
      "?cursor=" +
      req.query.cursor;
    q = q.start(req.query.cursor);
  }
  return datastore.runQuery(q).then((entities) => {
    results.items = entities[0].map(ds.fromDatastore);
    if (typeof prev !== "undefined") {
      results.previous = prev;
    }
    if (entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS) {
      results.next =
        req.protocol +
        "://" +
        req.get("host") +
        req.baseUrl +
        "?cursor=" +
        entities[1].endCursor;
    }
    return results;
  });
}

// create a boat
function post_boat(name, type, length, owner) {
  var key = datastore.key(BOAT);
  const new_boat = { name: name, type: type, length: length, owner: owner };
  return datastore.save({ key: key, data: new_boat }).then(() => {
    return key;
  });
}

// gets all boats owned by a specified user
function get_boats(owner, req) {
  var q = datastore.createQuery(BOAT).limit(5);
  const results = {};
  var prev;
  if (Object.keys(req.query).includes("cursor")) {
    prev =
      req.protocol +
      "://" +
      req.get("host") +
      req.baseUrl +
      "?cursor=" +
      req.query.cursor;
    q = q.start(req.query.cursor);
  }
  return datastore.runQuery(q).then((entities) => {
    results.items = entities[0]
      .map(ds.fromDatastore)
      .filter((item) => item.owner === owner);
    if (typeof prev !== "undefined") {
      results.previous = prev;
    }
    if (entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS) {
      results.next =
        req.protocol +
        "://" +
        req.get("host") +
        req.baseUrl +
        "?cursor=" +
        entities[1].endCursor;
    }
    return results;
  });
}

// Will return the total number of boats in the DB
function get_quantity_of_boats() {
  const q = datastore.createQuery(BOAT);
  return datastore.runQuery(q).then((entities) => {
    return entities[0].map(ds.fromDatastore).length;
  });
}

// replace name property of a boat
async function patch_boat(id, name, owner) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);
  boat = await get_item_by_id(id, BOAT);
  const new_boat = {
    name: name,
    type: boat.type,
    length: boat.length,
    owner: owner,
  };
  return datastore.save({ key: key, data: new_boat }).then(() => {
    return key;
  });
}

function put_load(boat_id, load_id, url) {
  const boat_key = datastore.key([BOAT, parseInt(boat_id, 10)]);
  return datastore.get(boat_key).then((boat) => {
    //console.log(boat[0]);
    if (typeof boat[0].loads === "undefined") {
      boat[0].loads = [];
    }
    boat[0].loads.push({
      key: load_id,
      self: url,
    });
    return datastore.save({
      key: boat_key,
      data: boat[0],
    });
  });
}

// If the load_id exists within the boat return true else false
function boat_has_this_load(loads, load_id) {
  flag = false;
  loads.forEach((load) => {
    if (load.key == load_id) {
      flag = true;
    }
  });
  return flag;
}

// this will remove the load from the loads array
async function remove_load(boat_id, load_id) {
  boat = await get_item_by_id(boat_id, BOAT);
  // remove the load from the boat.loads array
  for (var i = boat.loads.length - 1; i >= 0; i--) {
    if (boat.loads[i].key === load_id) {
      boat.loads.splice(i, 1);
    }
  }
  return boat.loads;
}

/* ------------- Begin boat Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

// create a new boat
router.post("/", checkJwt, function (req, res) {
  const accepts = req.accepts(["application/json", "text/html"]);
  if (!accepts) {
    // bad media
    res.status(406).send({ Error: "Invalid Media Type" });
  } else if (req.get("content-type") !== "application/json") {
    res
      .status(415)
      .send({ Error: "Server only accepts application/json data." });
  } else {
    // user property is derived from a valid jwt in checkJwt
    post_boat(req.body.name, req.body.type, req.body.length, req.user.sub).then(
      (key) => {
        url = makeUrl(req.protocol, req.get("host"), "/boats/", key.id);
        res.status(201).send({
          name: req.body.name,
          type: req.body.type,
          length: req.body.length,
          owner_id: req.user.sub,
          boat_id: key.id,
          self: url,
        });
      }
    );
  }
});

// get all of a users boats
router.get("/", checkJwt, function (req, res) {
  const accepts = req.accepts(["application/json", "text/html"]);
  if (!accepts) {
    // bad media
    res.status(406).send({ Error: "Invalid Media Type" });
  } else {
    const boats = get_boats(req.user.sub, req).then((boats) => {
      res.status(200).json(boats);
    });
  }
});

// Get boat specified by id
router.get("/:boat_id", async function (req, res) {
  boat = await get_item_by_id(req.params.boat_id, BOAT);
  const accepts = req.accepts(["application/json", "text/html"]);
  if (!accepts) {
    res.status(406).send({ Error: "Invalid Media Type" });
  } else if (boat === undefined) {
    res.status(404).send({ Error: "No boat with this boat_id exists" });
  } else {
    res.status(200).send({
      id: req.params.boat_id,
      name: boat.name,
      type: boat.type,
      length: boat.length,
      owner: boat.owner,
      loads: boat.loads,
      self: makeUrl(
        req.protocol,
        req.get("host"),
        "/boats/",
        req.params.boat_id
      ),
    });
  }
});

// Delete a protected boat. Requires authorization.
router.delete("/:boat_id", checkJwt, async function (req, res) {
  boat = await get_item_by_id(req.params.boat_id, BOAT);
  // JWT is valid but no boat with this boat_id exists.
  if (boat === undefined) {
    res.status(404).send({ Error: "No boat with this boat_id exists" });
  } else if (boat.owner !== req.user.sub) {
    res.status(403).send({ Error: "This is not your boat" });
  } else {
    const boat_to_delete = datastore.key([
      BOAT,
      parseInt(req.params.boat_id, 10),
    ]);
    await datastore.delete(boat_to_delete);
    res.status(204).send({ Success: "Deleted this boat" });
  }
});

// 405 response
router.delete("/", function (req, res) {
  res.set("Accept", "GET, POST");
  res.status(405).end();
});

// Patch a boat
router.patch("/:boat_id", checkJwt, async function (req, res) {
  boat = await get_item_by_id(req.params.boat_id, BOAT);
  // 406 if invalid content type
  if (req.get("content-type") !== "application/json") {
    res
      .status(415)
      .send({ Error: "Server only accepts application/json data." });
  }
  // valid JWT, but boat does not exist
  else if (boat === undefined) {
    res.status(403).send({ Error: "No boat with this boat_id exists" });
  }
  // not user's boat
  else if (boat.owner !== req.user.sub) {
    res.status(403).send({ Error: "This is not your boat" });
  }
  // patch boat
  else {
    patch_boat(req.params.boat_id, req.body.name, req.user.sub).then((key) => {
      res.status(200).send({ "New name": req.body.name });
    });
  }
});

//Put load on boat
router.put("/:boat_id/loads/:load_id", async function (req, res) {
  // bad boat or slip
  boat = await get_item_by_id(req.params.boat_id, BOAT);
  load = await get_item_by_id(req.params.load_id, LOAD);
  url = makeUrl(req.protocol, req.get("host"), "/loads/", req.params.load_id);
  if (boat === undefined || load === undefined) {
    res
      .status(404)
      .send({ Error: "The specified boat and/or load does not exist" });
  } else if (
    boat.loads !== undefined &&
    boat_has_this_load(boat.loads, req.params.load_id)
  ) {
    res.status(403).send({ Error: "This load is already on this boat" });
  } else {
    put_load(req.params.boat_id, req.params.load_id, url).then(
      res.status(204).end()
    );
  }
});

// Remove load from boat
router.delete("/:boat_id/loads/:load_id", async function (req, res) {
  const boat_key = datastore.key([BOAT, parseInt(req.params.boat_id, 10)]);
  boat = await get_item_by_id(req.params.boat_id, BOAT);
  load = await get_item_by_id(req.params.load_id, LOAD);

  if (boat === undefined || load === undefined) {
    res
      .status(404)
      .send({ Error: "The specified boat and/or load does not exist" });
  }
  // load isn't on boat
  else if (!boat_has_this_load(boat.loads, req.params.load_id)) {
    res.status(404).send({ Error: "This load is not on this boat" });
  } else {
    updated_load = await remove_load(req.params.boat_id, req.params.load_id);
    const updated_boat = {
      key: boat_key,
      data: {
        name: boat.name,
        type: boat.type,
        length: boat.length,
        owner: boat.owner,
        id: req.params.boat_id,
        loads: updated_load,
      },
    };
    await datastore.update(updated_boat);
    res.status(204).send();
  }
});

/* ------------- End Controller Functions ------------- */

app.use("/boats", router);

// ROUTE FOR BAD OR MISSING JWT
router.use("/", async function (err, req, res, next) {
  if (err.name === "UnauthorizedError") {
    if (req.method === "GET") {
      num_boats = await get_quantity_of_boats();
      const boats = get_boats_unprotected(req).then((boats) => {
        res.status(200).send({
          "Boats in Collection": num_boats,
          Boats: boats,
        });
      });
    } else {
      res.status(401).send({ Error: "invalid or missing token" });
    }
  } else {
    console.error(err.stack);
    res.status(500).send("Something broke!");
  }
});

module.exports = router;
