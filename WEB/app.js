/* globals Vuetify, Vue, axios, VueLoading, alertify, VueRouter, Vuex, io */

alertify.set("notifier","position", "top-center");

Vue.component("HomePage", {
    data: () => ({
        fields: {
            DocNr: null,
            Phone: null,
            Name: null,
            Lastname: null,
            Email: null
        },
        register: false,
    }),
    async mounted(){
        let {data} = await axios.get("http://localhost:3000/rest/check");
        if (data.ok) {
            this.$store.commit("setUser", data.obj);
            this.$router.push("/admin");
        }
    },
    methods: {
        clean(){
            for (let f in this.fields)
                this.fields[f] = null;
        },
        checkFields(){
            for (let f in this.fields)
                if (!this.fields[f]) return false;
            return true;
        },
        async send(){
            if (!this.checkFields())
                return alertify.error("All fields are required");
            let loading = this.$loading.show();
            let {data} = await axios.post("http://localhost:3000/rest/RegisterUser", {...this.fields});
            if (data.Reason)
                alertify.error(data.Reason.Text);
            if (data.response)
                alertify.success(data.response);
            loading.hide();
            this.register = false;
        },
        async login(){
            let loading = this.$loading.show();
            let {DocNr, Phone} = this.fields;
            let {data} = await axios.post("http://localhost:3000/rest/GetBalance", {DocNr, Phone});
            if (data.Reason)
                alertify.error(data.Reason.Text);
            else {
                this.$store.commit("setUser", {DocNr, Phone, Balance: data.response});
            }
            this.$router.push("/admin");
            loading.hide();
        }
    },
    template: `
        <div class='centered'>
            <div v-if='register'>
                <v-text-field
                v-model="fields.DocNr"
                label="Doc Nr"
                outlined
                />
                <v-text-field
                v-model="fields.Phone"
                label="Phone"
                outlined
                />
                <v-text-field
                v-model="fields.Name"
                label="Name"
                outlined
                />
                <v-text-field
                v-model="fields.Lastname"
                label="Lastname"
                outlined
                />
                <v-text-field
                v-model="fields.Email"
                label="Email"
                outlined
                />
                <v-btn
                @click="clean"
                style="width:100%"
                depressed
                color="primary"
                >
                Clear
                </v-btn>
                    <v-btn
                    @click="send"
                    depressed
                    color="primary"
                    style="width:100%;margin-top:5%;"
                    >
                    Register
                </v-btn>
            </div>
            <div v-else>
                <v-text-field
                v-model="fields.DocNr"
                label="Doc Nr"
                outlined
                />
                <v-text-field
                v-model="fields.Phone"
                label="Phone"
                outlined
                />
                <v-btn
                @click="clean"
                style="width:100%;"
                depressed
                color="primary"
                @click="register=true"
                >
                Register
                </v-btn>
                <v-btn
                
                @click="login"
                depressed
                style="width:100%;margin-top:5%;"
                color="primary"
                >
                Login
                </v-btn>
            </div>
    </div>
    `
});

Vue.component("AdminPage", {
    mounted(){
        if(!this.$store.state.currentUser.DocNr)
            return this.$router.push("/");
        let socket = io.connect("http://localhost:9999", { 
            query: `DocNr=${this.$store.state.currentUser.DocNr}`,
            transport : ["websocket"]
        });

        socket.on("new_balance", (e) => {
            let {emitter, bal} = e;
            if (axios.id === emitter) return;
            this.$store.state.currentUser.Balance = bal;
        });
    },
    data: () => ({
        model: "home",
        fields: {
            Balance: 0,
            Token: null,
            Id: null
        }
    }),
    methods: {
        async getToken() {
            let loading = this.$loading.show();
            let {DocNr, Phone} = this.$store.state.currentUser;
            let {data} = await axios.post("http://localhost:3000/rest/GenToken", {DocNr, Phone});
            if (data.Reason)
                alertify.error(data.Reason.Text);
            if (data.response){
                this.model = "mailing";
            }
            loading.hide();
        },
        async sendPay() {
            let {DocNr, Phone, Balance} = this.$store.state.currentUser;
            if (parseFloat(Balance) < parseFloat(this.fields.Balance)) 
                return alertify.error("User doesn't have enough balance, current balance: " + Balance);
            let loading = this.$loading.show();
            let {data} = await axios.post("http://localhost:3000/rest/DecreaseBalance", {DocNr, Phone, ...this.fields});
            if (data.Reason)
                alertify.error(data.Reason.Text);
            if (data.response){
                alertify.success(data.response);
                this.model = "home";
                this.$store.commit("decrementBalance", this.fields.Balance);
                this.fields.Balance = 0;
            }
            loading.hide();
        },
        async sendIncrement(){
            let loading = this.$loading.show();
            let {DocNr, Phone} = this.$store.state.currentUser;
            let {data} = await axios.post("http://localhost:3000/rest/IncreaseBalance", {DocNr, Phone, Balance: this.fields.Balance});
            if (data.Reason)
                alertify.error(data.Reason.Text);
            if (data.response){
                alertify.success(data.response);
                this.model = "home";
                this.$store.commit("incrementBalance", this.fields.Balance);
                this.fields.Balance = 0;
            }
            loading.hide();
        }
    },
    template: `
        <div class='centered'>
            <p> Your balance is: {{$store.state.currentUser.Balance}}
            <div v-if='model === "home"'>
                <v-btn
                style="width:100%"
                depressed
                color="primary"
                @click="model='adding'"
                >
                Increment Balance
                </v-btn>

                <v-btn
                style="width:100%; margin-top:5%"
                depressed
                color="primary"
                @click="model='paying'"
                >
                Pay
                </v-btn>
            </div>
            <div v-else-if="model==='paying'">
                <v-text-field
                v-model="fields.Balance"
                label="Amount"
                style="width:1005"
                outlined
                />
                <v-text-field
                v-model="fields.Token"
                label="Token"
                style="width:100%"
                outlined
                />
                <v-text-field
                v-model="fields.Id"
                label="Id"
                style="width:1005"
                outlined
                />
                <v-btn
                style="width:100%;"
                depressed
                color="primary"
                @click="getToken"
                >
                Get Token & Id
                </v-btn>
                <v-btn
                style="width:100%; margin-top:5%"
                depressed
                color="primary"
                @click="sendPay"
                >
                Pay
                </v-btn>
            </div>
            <div v-else-if="model==='mailing'">
                <p> Thanks {{$store.state.currentUser.DocNr}} you will receive Token & Id via e-mail. </p>
                <v-btn
                style="width:100%; margin-top:5%"
                depressed
                color="primary"
                @click="model='paying'"
                >
                Back
                </v-btn>
            </div>
            <div v-else-if="model==='adding'">
                <v-text-field
                v-model="fields.Balance"
                label="Amount"
                style="width:1005"
                outlined
                />
                <v-btn
                style="width:100%; margin-top:5%"
                depressed
                color="primary"
                @click="sendIncrement"
                >
                Increase
                </v-btn>
            </div>
        </div>
    `
});

Vue.use(VueLoading);
Vue.use(Vuex);

let router = new VueRouter({
    routes: [
        {path: "/", 
            component: {template: "<HomePage/>"}
        },
        {path: "/admin", 
            component: {template: "<AdminPage/>"}
        },
    ]
});

let store = new Vuex.Store({
    state: {
        currentUser: {}
    },
    mutations: {
        setUser (state, value) {
            state.currentUser = value;
        },
        decrementBalance (state, value) {
            state.currentUser.Balance = parseFloat(state.currentUser.Balance) - parseFloat(value);
        },
        incrementBalance (state, value) {
            state.currentUser.Balance = parseFloat(state.currentUser.Balance) + parseFloat(value);
        }
    }
});

new Vue({
    vuetify: new Vuetify(),
    el: "#app",
    router,
    store,
    template: `,
    <v-app>
        <router-view/>
    </v-app>
    `
}).$mount("#app");

