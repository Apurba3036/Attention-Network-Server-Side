const express=require('express');
const cors=require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app=express();
const port=process.env.PORT || 5000;

//middleware

app.use(cors());
app.use(express.json());



const uri = "mongodb+srv://nazmussakibapurbo:VRnpjaWBNOYBo2qD@cluster0.wznn11w.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const servicecollection=client.db('AttentionNetwork').collection('services');
    const bookingcollection=client.db('AttentionNetwork').collection('bookings')

    app.get('/services',async(req,res)=>{

        const cursor=servicecollection.find();
        const result=await cursor.toArray();
        res.send(result);
    })


    app.get('/services/:id',async(req,res)=>{

        const id=req.params.id;
        const query={_id:new ObjectId(id)}

        const options = {
            
            // Include only the `title` and `imdb` fields in the returned document
            projection: { image:1,title: 1 },
          };
        const result=await servicecollection.findOne(query,options);
        res.send(result);
    })

    //bookings

    app.post('/bookings',async(req,res)=>{

        const booking=req.body;
        console.log(booking);
        const result=await bookingcollection.insertOne(booking);
        res.send(result)
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/',(req,res)=>{
    res.send('Server is running')
})

app.listen(port,()=>{
    console.log("Attention networking server is running");
})