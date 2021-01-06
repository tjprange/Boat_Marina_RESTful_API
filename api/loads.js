const express = require("express");
const app = express();

const bodyParser = require("body-parser");
const router = express.Router();

const ds = require("./datastore");

const datastore = ds.datastore;

const LOAD = "Load";

router.use(bodyParser.json());

// Helper function returns an item of specified kind from the db
async function get_item_by_id(id, KIND) {
  const key = datastore.key([KIND, parseInt(id, 10)]);
  const [item] = await datastore.get(key);
  return item;
}

// Helper function builds a url. resource = '/loads/'
function makeUrl(protocol, host, resource, id) {
  return protocol + "://" + host + resource + id;
}

// Will return the total number of loads in the DB
function get_quantity_of_loads() {
  const q = datastore.createQuery(LOAD);
  return datastore.runQuery(q).then((entities) => {
    return entities[0].map(ds.fromDatastore).length;
  });
}

/* ------------- Begin Lodging Model Functions ------------- */

// adds a load to the db
function post_load(weight, content, delivery_date) {
  // weight content delivery_date
  var key = datastore.key(LOAD);
  const new_load = {
    weight: weight,
    content: content,
    delivery_date: delivery_date,
  };
  return datastore.save({ key: key, data: new_load }).then(() => {
    return key;
  });
}

// get all loads with pagination
function get_loads(req) {
  var q = datastore.createQuery(LOAD).limit(5);
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

// replace name property of a boat
async function patch_load(id, content) {
  const key = datastore.key([LOAD, parseInt(id, 10)]);
  load = await get_item_by_id(id, LOAD);
  const new_load = {
    weight: load.weight,
    content: content,
    delivery_date: load.delivery_date,
  };
  return datastore.save({ key: key, data: new_load }).then(() => {
    return key;
  });
}

// updates a load in the db
async function put_load(id, weight, content, delivery_date) {
  const key = datastore.key([LOAD, parseInt(id, 10)]);
  const new_load = {
    weight: weight,
    content: content,
    delivery_date: delivery_date,
  };
  return datastore.save({ key: key, data: new_load }).then(() => {
    return key;
  });
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

// create a load
router.post("/", function (req, res) {
  const accepts = req.accepts(["application/json", "text/html"]);
  if (!accepts) {
    // bad media
    res.status(406).send({ Error: "Invalid Media Type" });
  } else if (req.get("content-type") !== "application/json") {
    res
      .status(415)
      .send({ Error: "Server only accepts application/json data." });
  }
  // If missing data send 400 and error message
  else if (
    req.body.weight === undefined ||
    req.body.content === undefined ||
    req.body.delivery_date === undefined
  ) {
    res.status(400).send({
      Error:
        "The request object is missing at least one of the required attributes",
    });
  } else {
    // make a load
    post_load(req.body.weight, req.body.content, req.body.delivery_date).then(
      (key) => {
        url = makeUrl(req.protocol, req.get("host"), "/loads/", key.id);
        res.status(201).send({
          id: key.id,
          weight: req.body.weight,
          content: req.body.content,
          delivery_date: req.body.delivery_date,
          self: url,
        });
      }
    );
  }
});

// Get a load specified by :load_id from database
router.get("/:load_id", async function (req, res) {
  load = await get_item_by_id(req.params.load_id, LOAD);
  if (load === undefined) {
    res.status(404).send({ Error: "No load with this load_id exists" });
  } else {
    res.status(200).send({
      id: req.params.load_id,
      weight: load.weight,
      content: load.content,
      delivery_date: load.delivery_date,
      self: makeUrl(
        req.protocol,
        req.get("host"),
        "/loads/",
        req.params.load_id
      ),
    });
  }
});

// get all loads in the db
router.get("/", async function (req, res) {
  const accepts = req.accepts(["application/json", "text/html"]);
  if (!accepts) {
    // bad media
    res.status(406).send({ Error: "Invalid Media Type" });
  } else {
    num_loads = await get_quantity_of_loads();
    const loads = get_loads(req).then((loads) => {
      res.status(200).json({
        "Loads in collection": num_loads,
        Loads: loads,
      });
    });
  }
});

// patch a load
router.patch("/:load_id", function (req, res) {
  if (req.get("content-type") !== "application/json") {
    res
      .status(415)
      .send({ Error: "Server only accepts application/json data." });
  } else {
    patch_load(req.params.load_id, req.body.content).then((key) => {
      res.status(200).send({ content: req.body.content });
    });
  }
});

// put a load
router.put("/:load_id", function (req, res) {
  if (req.get("content-type") !== "application/json") {
    res
      .status(415)
      .send({ Error: "Server only accepts application/json data." });
  } else {
    put_load(
      req.params.load_id,
      req.body.weight,
      req.body.content,
      req.body.delivery_date
    ).then((key) => {
      url = makeUrl(req.protocol, req.get("host"), "/loads/", key.id);
      res.status(200).send({
        id: key.id,
        weight: req.body.weight,
        content: req.body.content,
        delivery_date: req.body.delivery_date,
        self: url,
      });
    });
  }
});

// delete load
router.delete("/:load_id", async function (req, res) {
  load = await get_item_by_id(req.params.load_id, LOAD);
  if (load === undefined) {
    res.status(404).send({ Error: "No load with this load_id exists" });
  } else {
    const load_to_delete = datastore.key([
      LOAD,
      parseInt(req.params.load_id, 10),
    ]);
    await datastore.delete(load_to_delete);
    res.status(204).send();
  }
});

/* ------------- End Controller Functions ------------- */

module.exports = router;
