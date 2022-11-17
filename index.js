const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const port = process.env.PORT || 5000;

const app = express();

// Middleware.........................
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.USER_NAMe}:${process.env.DB_PASSWORD}@cluster0.geiv5ao.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



const verifyJwt = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('Unauthorized access');
    }

    const token = authHeader.split(' ')[1]

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' });
        }
        req.decoded = decoded;
        next()
    })
}

const run = async () => {
    try {

        const appointmentOptionsCollection = client.db('DoctorPortal').collection('appointmentOptions');
        const bookingsCollections = client.db('DoctorPortal').collection('bookings');
        const usersCollections = client.db('DoctorPortal').collection('users')

        app.get('/appointmentOptions', async (req, res) => {
            const date = req.query.date;
            const query = {};
            const options = await appointmentOptionsCollection.find(query).toArray();
            const bookingQuery = { appointmentDate: date };
            const allreadyBooked = await bookingsCollections.find(bookingQuery).toArray()

            options.forEach(option => {
                const optionBooked = allreadyBooked.filter(book => book.treatment === option.name)
                const bookedSlots = optionBooked.map(book => book.slot);

                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = remainingSlots;
            })
            res.send(options);
        })

        app.post('/bookings', async (req, res) => {
            const bookings = req.body;
            const query = {
                appointmentDate: bookings.appointmentDate,
                email: bookings.email,
                treatment: bookings.treatment,
            }
            const allreadyBooked = await bookingsCollections.find(query).toArray();

            if (allreadyBooked.length) {
                const message = 'You Have already have booking';
                return res.send({ acknowledge: false, message });
            }

            const result = await bookingsCollections.insertOne(bookings);
            res.send(result);
        })

        app.get('/bookings', verifyJwt, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ message: "Forbidden Access" })
            }
            const query = {
                email: email,
            }
            const resutl = await bookingsCollections.find(query).toArray();
            res.send(resutl);
        })

        // get jwt tocken to the client site for imedieat signin user.....................
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await usersCollections.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: '' });
        })

        app.get('/users', async (req, res) => {
            const query = {}
            const users = await usersCollections.find(query).toArray()
            res.send(users);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollections.insertOne(user);
            res.send(result)
        })

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollections.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })

        app.put('/users/admin/:id', verifyJwt, async (req, res) => {

            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail }
            const user = await usersCollections.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'Forbidden Access' })
            }

            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const option = { upsert: true }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollections.updateOne(filter, updatedDoc, option)
            res.send(result)


        })


    }
    finally {

    }
}

run().catch(console.error);





app.get('/', async (req, res) => {
    res.send('doctor portal server is running')
})

app.listen(port, () => {
    console.log(`Doctor portal is runnign on PORT ${port}`);
})