const express = require('express');
const socketio = require('socket.io');
const http = require('http');
const { Pool } = require('pg');
// const connectionString  = 'postgres://ndcfznknhgtflt:fa9b3c262cb55a6ddee8461a42faeffcb8ca232a2cc8fce0886b60aa2b91ac3f@ec2-34-239-196-254.compute-1.amazonaws.com:5432/d9si4nnq50sv87';   //username:password@location:port/dbname
const PORT = 3001;


const router = require('./router');
const { query } = require('express');
const app = express();
const server = http.createServer(app);

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    ssl: { rejectUnauthorized: false }
});

//Check if connection is good or bad
pool.connect(err => {
    if(err) {
        console.error('Database connection error', err.stack);
    }
    else {
        console.log('Connected to database');
    }
})

const io = socketio(server);

io.on('connection', (socket) => {
    console.log('USER CONNECTION');

    socket.on('disconnect', () => {
        console.log('user has left');
    });

    socket.on("getAllData", () => {
        //Base query
        var queryText = 'SELECT id FROM orderprod order by id desc';

        pool.query(queryText, (err ,res) => {
            if(err) throw err

            console.log(res.rows);
            
           io.emit("getAllData", {lista : res.rows});
        })
    })

    socket.on("getMachinesFreedom",async data => {
        
        let maqs = [];
        let mtgs = [];

        for (const iterator of data) {
            if(iterator.includes('MAQ') || iterator.includes('IND') || iterator.includes('TORNO') || iterator.includes('FRESA') ){
                maqs.push(`'`+iterator+`'`);
            }else{
                if(iterator.includes('MTG')){
                    mtgs.push(`'`+iterator+`'`);
                }
            }
        }

        var queryText = `SELECT opm.*, op.id, p.cod, op.qtde 
        from orderprodmaquina opm 
        inner join orderprod op on opm."orderProd" = op.id
        inner join product p on op.product = p.id
        where `;

        var queryExec = `select opm.*,
         opm.id as orderprodmaquinaid, 
         op.*, 
         op.id as orderprodid, 
         nt.*, 
         nt.id as noteprodid,
         p.cod as produtocod,
         p.id as productid,
         m.cod as "colaboradorNome"
        from orderprodmaquina opm 
        inner join orderprod op on opm."orderProd" = op.id 
        inner join noteprod nt on nt."orderProd" = op.id
        inner join product p on op.product = p.id
        inner join machinelabor m on nt.colaborador = m.id
        where 
        `

        // nt."dataFim" = '' and (opm."statusEtapa" = 'execucao' or opm."statusEtapa" = 'execução')
        // and 
        if(mtgs.length != 0 && maqs.length != 0 ){
            queryText += ` (montagem in (${mtgs}) or maquina in (${maqs}))`
            queryExec += ` (opm.montagem in (${mtgs}) or opm.maquina in (${maqs}))`
        }else{
            if(maqs.length != 0){
                queryText += ` maquina in (${maqs})`
                queryExec += ` opm.maquina in (${maqs})`
            }
            if(mtgs.length != 0 ){
                queryText += ` opm.montagem in (${mtgs})`
                queryExec += ` opm.montagem in (${mtgs})`
            }
        }

        queryText += ` and ("statusEtapa" = 'liberada');` 
        //queryExec += ` and (regexp_replace(opm."statusEtapa", '[^a-zA-Z0-9]', '', 'g') = 'execucao') and (nt."dataFim" = '');`
        queryExec += ` and (opm."statusEtapa" = 'execução' or opm."statusEtapa" = 'execucao') and (nt."dataFim" = '');`
        


        try {
            const res1 = await pool.query(queryText);
            const res2 = await pool.query(queryExec);

            if(res1 && res2){
                io.to(socket.id).emit("getMachinesFreedom", { lista: res1.rows, listaexec : res2.rows }); 
            }

        } catch (error) {
            console.log(error);
        }

        // pool.query(queryText, (err ,res) => {
        //     if(err) throw err
        //     pool.query(queryExec, (err ,res2) => {
        //         if(err) throw err
        //        io.to(socket.id).emit("getMachinesFreedom", {listaexec : res2.rows, lista: res.rows });
        //     })
        // })
    });

    socket.on('getMachinesExec', () => {
        var queryText = `SELECT * FROM  `
    });


    
})

app.use(router);



server.listen(PORT, () => console.log('server is running'))