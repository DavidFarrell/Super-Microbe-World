#pragma strict

/*--v--v--v--v--v--v--*--v--v--v--v--v--v--Test variables--v--v--v--v--v--v--*--v--v--v--v--v--v--*/


private var timer: float;
private var debugMode: boolean = false;				//When true, this script displays all the Debug messages.

/*--v--v--v--v--v--v--*--v--v--v--v--v--v--Variables--v--v--v--v--v--v--*--v--v--v--v--v--v--*/

	//vars to use layerMasks 
//private var groundLayer: int = 12;
//private var playerLayer: int = 9;
//private var nonEnemiesLayer: int = 13;
//private var enemiesLayer: int = 8;
//private var projectilesLayer = 11;
//We'll use the LayerMask to detect just the collisions with the ground objects when deciding where to walk. More info about layerMasks here: http://answers.unity3d.com/questions/8715/how-do-i-use-layermasks.html
//DELETEprivate var groundLayerMask: int = 1 << groundLayer;	//The number of layer for the ground is 12: so the mask will be 0000 0000 0000 0000 0001 0000 0000 0000
//DELETEprivate var groundLayerMask: int = 1 << utils.layers.ground;	//The number of layer for the ground is 12: so the mask will be 0000 0000 0000 0000 0001 0000 0000 0000
//private var bugsLayerMask: int = (1 << utils.layers.enemies) | (1 << utils.layers.nonEnemies);	//Layer mask with two layers activated

	//Vars to check if grounded
private var groundHitsNumber: int;
private var groundHits: RaycastHit2D[];
public var groundDistance: float = 1.3;
private var groundDirection: Vector2;
private var grounded: boolean;
private var groundedPreviousValue: boolean = true;

	//Vars to move the player
public var maxSpeed: float = 5;				//maxSpeed of the player
public var jumpForce: int = 700;				//Force applied to the player when Jumping
public var moveForce: float; 			//Force applied to the player when accelerating
private var horizAxis: float; 				//Will take values in this interval [-1, 1] keeping the direction of the horizontal input of the controller (keyboard, joystick..)
private var facingRight: boolean;			//True if the player is facing right, false if not.
private var facingDirection: Vector2;		//Vector2 pointing to the direction where the player is looking at
private var hitDirection: Vector2;			//Contains the direction of the player's hit with something in the world to disable the movement in that direction. Will contain (0, 0)
private var hitDirectionResetTimer: float;	//Timer to reinitialize the hitDirection. hitDirection's x coordinate should be 0 any time the trigger is not colliding with any collider, but it doesn't because OnTriggerExit2D is not working very accurately. We set up this timer to reset to 0 the hitDirection regularly, avoiding it gets stuck in 1 or -1 values.
private var hasBeenRunning: boolean;			//True if the player's speed has been 

	//Variables of the "take photo" feature
private var photoPoint: Transform;			//To store the point where the photos will be taken from
private var photoLength: int = 3;				//The scope of the photos
private var photoReceivers: RaycastHit2D[]; //To store the colliders which the ray went through

	//Variables used to shoot soap
private var shootPoint: Transform;
public var dropSoapPrefab: Rigidbody2D;			//Will reference the prefab of the soap. The prefab will have to be dropped here in the inspector.
public var soapForce: float;					//Force with which the soap will be thrown

	//Other vars
private var myTransform: Transform;			//It's more efficient to keep in variables the components of the gameObject
private var myRigidbody2D: Rigidbody2D;
private var low_anim: Animator;
private var up_anim: Animator;


/*--v--v--v--v--v--v--*--v--v--v--v--v--v--Functions--v--v--v--v--v--v--*--v--v--v--v--v--v--*/

function Awake () {

	myTransform = transform;
	low_anim = myTransform.Find("low_player").GetComponent(Animator);
	up_anim = myTransform.Find("up_player").GetComponent(Animator);
	myRigidbody2D = myTransform.rigidbody2D;
	facingRight = true;
	facingDirection = Vector2.right;
	
	groundHits = new RaycastHit2D[3];
	groundDirection = Vector2(0, -1);
	groundedPreviousValue = false;
	hitDirection = Vector2(0, 0);				//To control the movement if the player is hitting any object
	
	photoPoint = myTransform.Find("photo_point").transform;
	photoReceivers = new RaycastHit2D[3];
	
	shootPoint = myTransform.Find("shoot_point").transform;
	
}

function Start () {
	
	//Just for testing
	//Physics2D.IgnoreLayerCollision(utils.layers.player, utils.layers.projectiles, true);

}

function Update () {

	low_anim.ResetTrigger("jump_end");					//Usually, this trigger got stuck to true (unexplicably). This line fixes it.
	
	//showMessages();
	
	/*--v--v--v--v--v--v--Code to jump--v--v--v--v--v--v--*/
	
	//static function DrawRay(start: Vector3, dir: Vector3, color: Color = Color.white, duration: float = 0.0f, depthTest: bool = true): void;
	
	Debug.DrawRay(myTransform.position, groundDirection*groundDistance, Color.black, 0);
	
	//static function RaycastNonAlloc(origin: Vector2, direction: Vector2, results: RaycastHit2D[], distance: float = Mathf.Infinity, layerMask: int = DefaultRaycastLayers, minDepth: float = -Mathf.Infinity, maxDepth: float = Mathf.Infinity): int;
	
	groundHitsNumber = Physics2D.RaycastNonAlloc(myTransform.position, groundDirection, groundHits, groundDistance, utils.layerMasks.groundAndBugs);
	
	
	//Debug.DrawLine(myTransform.position, groundPoint, Color.red, 0, false);
	//groundHitsNumber = Physics2D.LinecastNonAlloc(myTransform.position, groundDirection, groundHits, groundLayerMask);
	if (groundHitsNumber == 0){ 
		grounded = false;
		if (debugMode) Debug.Log("Not grounded");
	}
	else{
		grounded = true;
		if (debugMode) Debug.Log("Grounded");
	}
	
	if (grounded && Input.GetButtonDown("Jump")){
		myRigidbody2D.AddForce(new Vector2(0, jumpForce));		// Add a vertical force to the player.
		low_anim.SetTrigger("jump_start");
	}
	
	if (!groundedPreviousValue && grounded){
		low_anim.SetTrigger("jump_end");
		//Debug.Log("Landed!");
	}
	groundedPreviousValue = grounded;
	
	/*--v--v--v--v--v--v--Code to control other buttons--v--v--v--v--v--v--*/
	
	if (Input.GetButtonDown("Fire1")){
		takePhoto();
	}
	
	if (Input.GetButtonDown("Fire2")){
		shoot();
	}
	
}

function FixedUpdate () {
	
	
	/*--v--v--v--v--v--v--Code to move--v--v--v--v--v--v--*/
	horizAxis = Input.GetAxis("Horizontal");				//Cache the horizontal input
	
	/*
	hitDirectionResetTimer += Time.deltaTime;
	if (grounded && hitDirectionResetTimer > 0.35){						//To reset the hitDirection every 0.35 secs to avoid it from getting stuck when OnTriggerExit fails (it does fail).
		hitDirectionResetTimer = 0;
		//hitDirection.x = 0;
	}
	*/
	/*
	if(hitDirection.x != 0 && Mathf.Sign(horizAxis) == Mathf.Sign(hitDirection.x)) 			//To stop the player applying forces against some object if they are colliding
		horizAxis = 0;
	*/
	
	low_anim.SetFloat("speed", Mathf.Abs(horizAxis));
	up_anim.SetFloat("speed", Mathf.Abs(horizAxis));
	
	if(Mathf.Abs(myRigidbody2D.velocity.x) > 0.6 ){
		if (horizAxis * myRigidbody2D.velocity.x >= maxSpeed){
			myRigidbody2D.velocity = Vector2(Mathf.Sign(myRigidbody2D.velocity.x) * maxSpeed, myRigidbody2D.velocity.y);	// ... set the player's velocity to the maxSpeed in the x axis.
		}
		else{						// If the player is changing direction (h has a different sign to velocity.x) or hasn't reached maxSpeed yet...
			myRigidbody2D.AddForce(Vector2.right * horizAxis * moveForce);				// ... add a force to the player.
		}
	}
	else{
		if(horizAxis * myRigidbody2D.velocity.x < maxSpeed)
			myRigidbody2D.AddForce(Vector2.right * horizAxis * moveForce);				// ... add a force to the player.
	}
	
	
	/*it works!!!*/
	/**/
	//myRigidbody2D.velocity.x = horizAxis * maxSpeed;
	/**/
	/*it works!!!*/
	
	if(myRigidbody2D.velocity.x > 0.1 && !facingRight)						// If the input is moving the player right and the player is facing left...
		Flip();																// ... flip the player.
	else if(myRigidbody2D.velocity.x < -0.1 && facingRight)					// Otherwise if the input is moving the player left and the player is facing right...
		Flip();																//Note that there is a little margin of 0,2 to avoid it from flipping very fast. This margin should be tested an adjusted if is not well set.
	
}

function shoot() {
	
	up_anim.SetTrigger("shoot_soap");
	yield new WaitForSeconds(0.2);
	var dropSoap: Rigidbody2D = Instantiate(dropSoapPrefab, shootPoint.position, myTransform.rotation);
	/*if(!facingRight){
		var dropScale: Vector3 = dropSoap.localScale;				//Multiply the player's x local scale by -1.
		dropScale.x *= -1;
		dropSoap.localScale = dropScale;
	}*/
	dropSoap.AddForce(facingDirection * soapForce);
}

/*
function OnTriggerEnter2D (hit: Collider2D) {
	
	var hitGameObject: GameObject = hit.gameObject;
	//Debug.Log("Collision with object in Layer: " + hitGameObject.layer);
	if(	hitGameObject.layer == utils.layers.ground || 
		hitGameObject.layer == utils.layers.enemies || 
		hitGameObject.layer == utils.layers.nonEnemies){
		
		if(facingRight)
			hitDirection = Vector2(1, 0);
		else 
			hitDirection = Vector2(-1, 0);
		Debug.Log("Collision direction: " + hitDirection + "Object layer: " + hitGameObject.layer);
	}
}

function OnTriggerExit2D(hit: Collider2D){

	hitDirection = Vector2(0, 0);
	Debug.Log("Collision exit");

}
*/

//Plays the take photo animation and trigger this animation on any bug that is in the photo trayectory.
private function takePhoto () {

	Debug.DrawRay(photoPoint.position, facingDirection*photoLength, Color.red, 1);
	up_anim.SetTrigger("take_photo");
	var receivers: int = Physics2D.RaycastNonAlloc(photoPoint.position, facingDirection, photoReceivers, photoLength, utils.layerMasks.bugs);
	for (var i: int = 0; i < receivers; i++) {
		photoReceivers[i].transform.SendMessage("bePhotographed");
	}
	
}

private function Flip () {

	facingRight = !facingRight;
	facingDirection = facingDirection * (-1);
	
	var bugScale: Vector3 = myTransform.localScale;				//Multiply the player's x local scale by -1.
	bugScale.x *= -1;
	myTransform.localScale = bugScale;

}

//This function triggers the debugMode to true during 1 frame each second. It is intended to show one frame per second the Debug messages. Use this way:
//if (debugMode) Debug.log("Your message");
private function showMessages(){
	timer += Time.deltaTime;
	debugMode = false;
	if (timer > 1){
		debugMode = true;
		timer = 0;
	}	
}