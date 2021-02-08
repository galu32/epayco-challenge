# - Challenge Epayco -

### Instalacion:

   - Tener en cuenta que se debe tener mysql instalado, y configurar los datos de acceso en el directorio donde este el repositorio /config.json, adicional tener en cuenta que el mail que se usa para el mailing, puede no responder si google bloquea la ip, por lo que si esto sucede se debe tambien configurar un mail/contraseña en el mismo archivo valido para la ip desde donde se esta levantando el servidor

    https://nodemailer.com/usage/using-gmail/

### Instalacion de mysql (o su equivalente en Windows/Mac):

    sudo apt install mysql-server
    sudo mysql_secure_installation
    sudo mysql
    CREATE DATABASE epayco;

### Instalacion de la app:

    git clone...
    cd /$PATH/$REPOPATH
    npm install
    npm start

### Tests:

    sudo mysql (o su equivalente en otro OS que no sea UNIX)
    CREATE DATABASE epayco_test;
    npm install (si no se realizo antes)
    npm test

### De que se trata?

El proyecto cuenta con 3 servidores (simulados por 3 routers de express) detallados a continuación:

### 1) Server SOAP:

***Funcion**: se encarga de toda la parte logica y chequeos, es el unico que tiene acceso a la base de datos como tambien gestiona el envio por mail del token y el id de transaccion para poder realizar una baja al saldo total del usuario registrado

***Implementaciones**:

- **Mysql**: se implementa un pool para la conexion a la base, todas las transacciones se basan en el nivel de isolacion "repeteable read", esto para implementar rollbacks en caso de que un query falle o devuelva un error, el commit no es automatico y se evita transacciones concurrentes.

Ejemplo de un insert donde **el indice DocNr ya** existe:

> ROLLBACK;
> START TRANSACTION;
> INSERT INTO user SET `DocNr` = 123.......;
> ROLLBACK;

Ejemplo de un insert donde **el indice DocNr no** existe:

> ROLLBACK;
> START TRANSACTION;
> INSERT INTO user SET `DocNr` = 124.......;
> COMMIT;

mientras una transaccion esta en proceso, ningun query puede iniciar otra transaccion hasta que no se termine la misma, de esta manera todos los queries tienen una imagen actualizada de la base de datos

- **Cachemanager**: se implementa un modelo de cache simple set/get (similar a redis/memcached) para reducir la cantidad de consultas a la base de datos, sobretodo en los servicios que utilizan el metodo utils:getUser para validar los datos del DocNr / Phone que recibe, como tambien los servicios de consultas al objecto User.

**Endpoint**: /soap:

**Servicios**:

- /user/RegisterUser:

**Descripcion**: registra un usuario nuevo.

**Ejemplo de peticion:**

>        <?xml version="1.0" encoding="UTF-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
>            xmlns:tns="http://example.com/user.wsdl"
>            xmlns:xsd1="http://example.com/user.xsd"
>            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
>            <soap:Body>
>                <xsd1:UserRequest>
>                    <DocNr>Integer</DocNr>
>                    <Phone>Integer</Phone>
>                    <Name>String</Name>
>                    <Lastname>String</Lastname>
>                    <Email>String</Email>
>                </xsd1:UserRequest>
>            </soap:Body>
>        </soap:Envelope>

**Ejemplo de respuesta:**

**Positiva:**

>        <?xml version="1.0" encoding="utf-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/user.wsdl" xmlns:xsd1="http://example.com/user.xsd">
>            <soap:Body>
>                <xsd1:UserResponse xmlns:xsd1="http://example.com/user.xsd">
>                    <response>User registered</response>
>                </xsd1:UserResponse>
>            </soap:Body>
>        </soap:Envelope>

**Negativa:**

>        <?xml version="1.0" encoding="utf-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/user.wsdl" xmlns:xsd1="http://example.com/user.xsd">
>            <soap:Body>
>                <soap:Fault>
>                    <soap:Code>
>                        <soap:Value>Already Exist</soap:Value>
>                    </soap:Code>
>                    <soap:Reason>
>                        <soap:Text>User with DocNr 123 already exist.</soap:Text>
>                    </soap:Reason>
>                </soap:Fault>
>            </soap:Body>
>        </soap:Envelope>

- /user/GetBalance:

**Descripcion**: consulta el balance de un usuario

**Ejemplo de peticion:**

>        <?xml version="1.0" encoding="UTF-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/user.wsdl" xmlns:xsd1="http://example.com/user.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
>        <soap:Body>
>            <xsd1:GetBalanceRequest>
>                <DocNr>Interger</DocNr>
>                <Phone>Integer</Phone>
>            </xsd1:GetBalanceRequest>
>        </soap:Body>
>        </soap:Envelope>

**Ejemplo de respuesta**:

**Positiva:**

>        <?xml version="1.0" encoding="utf-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/user.wsdl" xmlns:xsd1="http://example.com/user.xsd">
>            <soap:Body>
>                <xsd1:GetBalanceResponse xmlns:xsd1="http://example.com/user.xsd">
>                    <response>0</response>
>                </xsd1:GetBalanceResponse>
>            </soap:Body>
>        </soap:Envelope>

**Negativa**:

>        <?xml version="1.0" encoding="utf-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/user.wsdl" xmlns:xsd1="http://example.com/user.xsd">
>            <soap:Body>
>                <soap:Fault>
>                    <soap:Code>
>                        <soap:Value>User doesn't Exist</soap:Value>
>                    </soap:Code>
>                    <soap:Reason>
>                        <soap:Text>User with DocNr 3123 and Phone 123 doesn't exist.</soap:Text>
>                    </soap:Reason>
>                </soap:Fault>
>            </soap:Body>
>        </soap:Envelope>

- /user/UpdateBalance:

**Descripcion**: se encarga de sumar o restar saldo en la cuenta del cliente:

**Ejemeplo de peticion:**

***Restar Saldo:**

>        <?xml version="1.0" encoding="UTF-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/user.wsdl" xmlns:xsd1="http://example.com/user.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
>        <soap:Body>
>            <xsd1:UpdateBalanceRequest>
>                <DocNr>Integer</DocNr>
>                <Phone>Integer</Phone>
>                <Balance>Float</Balance>
>                <Type>-</Type>
>                <Token>String</Token>
>                <Id>String</Id>
>            </xsd1:UpdateBalanceRequest>
>        </soap:Body>
>        </soap:Envelope>

**Ejemplo de Respuesta:**

**Positiva:**

>        <?xml version="1.0" encoding="utf-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/user.wsdl" xmlns:xsd1="http://example.com/user.xsd">
>            <soap:Body>
>                <xsd1:UpdateBalanceResponse xmlns:xsd1="http://example.com/user.xsd">
>                    <response>Balance updated correctly.</response>
>                </xsd1:UpdateBalanceResponse>
>            </soap:Body>
>        </soap:Envelope>


**Negativa:**

>        <?xml version="1.0" encoding="utf-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/user.wsdl" xmlns:xsd1="http://example.com/user.xsd">
>            <soap:Body>
>                <soap:Fault>
>                    <soap:Code>
>                        <soap:Value>Insufficent Balance</soap:Value>
>                    </soap:Code>
>                    <soap:Reason>
>                        <soap:Text>User doesn't have enough balance, current balance: 0</soap:Text>
>                    </soap:Reason>
>                </soap:Fault>
>            </soap:Body>
>        </soap:Envelope>

>         <?xml version="1.0" encoding="utf-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/user.wsdl" xmlns:xsd1="http://example.com/user.xsd">
>            <soap:Body>
>                <soap:Fault>
>                    <soap:Code>
>                        <soap:Value>Invalid or Expired</soap:Value>
>                    </soap:Code>
>                    <soap:Reason>
>                        <soap:Text>Token 23284fae-6bb6-4b82-a506-104ccaec6556 or Id 123123 is invalid or expired.</soap:Text>
>                    </soap:Reason>
>                </soap:Fault>
>            </soap:Body>
>        </soap:Envelope>

***Sumar Saldo:**

**Ejemplo de peticion:**

>        <?xml version="1.0" encoding="UTF-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/user.wsdl" xmlns:xsd1="http://example.com/user.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
>        <soap:Body>
>            <xsd1:UpdateBalanceRequest>
>                <DocNr>Integer</DocNr>
>                <Phone>Integer</Phone>
>                <Balance>Integer</Balance>
>                <Type>+</Type>
>            </xsd1:UpdateBalanceRequest>
>        </soap:Body>
>        </soap:Envelope>

**Ejemplo de Respuesta:**

**Positiva:**

>        <?xml version="1.0" encoding="utf-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/user.wsdl" xmlns:xsd1="http://example.com/user.xsd">
>            <soap:Body>
>                <xsd1:UpdateBalanceResponse xmlns:xsd1="http://example.com/user.xsd">
>                    <response>Balance updated correctly.</response>
>                </xsd1:UpdateBalanceResponse>
>            </soap:Body>
>        </soap:Envelope>

**Negativa:**

>        <?xml version="1.0" encoding="utf-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/user.wsdl" xmlns:xsd1="http://example.com/user.xsd">
>            <soap:Body>
>                <soap:Fault>
>                    <soap:Code>
>                        <soap:Value>User doesn't Exist</soap:Value>
>                    </soap:Code>
>                    <soap:Reason>
>                        <soap:Text>User with DocNr 333 and Phone 123 doesn't exist.</soap:Text>
>                    </soap:Reason>
>                </soap:Fault>
>            </soap:Body>
>        </soap:Envelope>

- /payment/GenToken:

**Ejemplo de peticion:**

>        <?xml version="1.0" encoding="UTF-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/payment.wsdl" xmlns:xsd1="http://example.com/payment.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
>        <soap:Body>
>            <xsd1:GenTokenRequest>
>                <DocNr>Integer</DocNr>
>                <Id>String</Id>
>            </xsd1:GenTokenRequest>
>        </soap:Body>
>        </soap:Envelope>

**Ejemplo de respuesta:**

**Positiva:**

>        <?xml version="1.0" encoding="utf-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/payment.wsdl" xmlns:xsd1="http://example.com/payment.xsd">
>            <soap:Body>
>                <xsd1:GenTokenResponse xmlns:xsd1="http://example.com/payment.xsd">
>                    <response>You will receive your Token via E-mail.</response>
>                </xsd1:GenTokenResponse>
>            </soap:Body>
>        </soap:Envelope>

**Negativa:**

>         <?xml version="1.0" encoding="utf-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/payment.wsdl" xmlns:xsd1="http://example.com/payment.xsd">
>            <soap:Body>
>                <soap:Fault>
>                    <soap:Code>
>                        <soap:Value>User doesn't Exist</soap:Value>
>                    </soap:Code>
>                    <soap:Reason>
>                        <soap:Text>User with DocNr 1233 doesn't exist.</soap:Text>
>                    </soap:Reason>
>                </soap:Fault>
>            </soap:Body>
>        </soap:Envelope>

>        <?xml version="1.0" encoding="utf-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/payment.wsdl" xmlns:xsd1="http://example.com/payment.xsd">
>            <soap:Body>
>                <soap:Fault>
>                    <soap:Code>
>                        <soap:Value>Already Exist</soap:Value>
>                    </soap:Code>
>                    <soap:Reason>
>                        <soap:Text>Already Exist a Valid Token for User 123.</soap:Text>
>                    </soap:Reason>
>                </soap:Fault>
>            </soap:Body>
>        </soap:Envelope>

- /payment/ValidToken:

**Ejemplo de peticion:**

>        <?xml version="1.0" encoding="UTF-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/payment.wsdl" xmlns:xsd1="http://example.com/payment.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
>        <soap:Body>
>            <xsd1:ValidTokenRequest>
>                <DocNr>Integer</DocNr>
>                <Id>String</Id>
>                <Token>String</Token>
>            </xsd1:ValidTokenRequest>
>        </soap:Body>
>        </soap:Envelope>

**Ejemplo de respuesta:**

**Positiva:**

>        <?xml version="1.0" encoding="utf-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/payment.wsdl" xmlns:xsd1="http://example.com/payment.xsd">
>            <soap:Body>
>                <xsd1:ValidTokenResponse xmlns:xsd1="http://example.com/payment.xsd">
>                    <response>true</response>
>                </xsd1:ValidTokenResponse>
>            </soap:Body>
>        </soap:Envelope>

**Negativa:**

>        <?xml version="1.0" encoding="utf-8"?>
>        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/payment.wsdl" xmlns:xsd1="http://example.com/payment.xsd">
>            <soap:Body>
>                <soap:Fault>
>                    <soap:Code>
>                        <soap:Value>Invalid or Expired</soap:Value>
>                    </soap:Code>
>                    <soap:Reason>
>                        <soap:Text>Token 05624703-9a10-4981-b789-10d4e9027165 or Id 123 is invalid or expired.</soap:Text>
>                    </soap:Reason>
>                </soap:Fault>
>            </soap:Body>
>        </soap:Envelope>

### 2) Server REST:

***Funcion**: se encarga principalmente de actuar como gateway entre el cliente y el server SOAP

***Implementaciones**: implementa un cache similar al del server SOAP para reducir la cantidad de peticiones en consultas, maneja la session del cliente con el cache si es que las peticiones cuentan con el header "ui-id" generado por express-session en el server web.

Implementa tambien un socket con el cliente web para si se tiene abierto el mismo usuario en dos navegadores distintos, y uno actualiza el balance de la cuenta, el otro tambien cuente con este balance total actualizado.

**Endpoint:** /rest

**-Endpoints:**

## *Repiten las respuestas del SOAP en formato JSON

- /rest/RegisterUser:

    **Ejemplo de peticion:**

        {
            "DocNr": Integer,
            "Phone": Integer,
            "Name": String",
            "Lastname": String,
            "Email": String,
        }

- /rest/IncreaseBalance:

    **Ejemplo de peticion:**

        {
            "DocNr": Integer,
            "Phone": Integer,
            "Balance": Integer
        }

- /rest/DecreaseBalance:

    **Ejemplo de peticion**:

        {
            "DocNr": Integer,
            "Phone": Integer,
            "Balance": Integer,
            "Token": String,
            "Id": String
        }

- /rest/GetBalance:

    **Ejemplo de peticion:**

        {
            "DocNr": Integer,
            "Phone": Integer
        }

- /rest/GenToken:

    **Ejemeplo de peticion:**

        {
            "DocNr": Integer,
            "Id": Integer
        }

### 3) Server WEB:

**Enpoint: /ui**

***Funcion**: es un server simple que renderiza un html con los script de Vue y genera un session ID para que el cliente interactue con el cache del REST. Genera una interfaz de usuario simple para poder interactuar con los servicios.


##### Dentro de cada directorio correspondiente a un API se encuentra la coleccion de Postman que interactua con los server sin necesidad de utilizar la ui.