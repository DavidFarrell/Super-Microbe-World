#pragma strict

public class Microbe extends MonoBehaviour{
	
	public var life: int; 							//Life of the microbe. 
	public var affectedByWhiteBC: boolean;			//If true it will be harmed by the white blood cells 
	public var whiteBCDamage: int;					//Amount of damage caused by the white blood cells
	public var affectedBySoap: boolean;				//Same purpose than the 'affectedByWhiteBC' var, but with the soap.
	public var soapDamage: int;
	public var affectedByAntibiotics: boolean;
	public var antibioticsDamage: int;
	
	protected var microbeName: String;				//will contain the name of the microbe that this script is attached to
	
	/*Debug vars*/
	protected var debugMode: boolean = false;				//When true, this script displays all the Debug messages.
	protected var timer: float = 0;
	
	protected var anim: Animator;
	
	protected var myTransform: Transform;			//To keep the transform of the microbe
	protected var myGameObject: GameObject;
	protected var myRigidbody2D: Rigidbody2D;
	protected var goals: Goals;						//Will keep a reference to the Goals.js script, used to update the goals of the levels when the microbe has been photographed, washed away, shooted a white blood cell or affected by an antibiotic pill.
	
	//To keep the number of the layers
//	protected var groundLayer: int = 12;
//	protected var playerLayer: int = 9;
//	protected var nonEnemiesLayer: int = 13;
//	protected var enemiesLayer: int = 8;
//
//	//We'll use the LayerMask to detect just the collisions with the ground objects when deciding where to walk. More info about layerMasks here: http://answers.unity3d.com/questions/8715/how-do-i-use-layermasks.html
//	protected var groundLayerMask: int = 1 << groundLayer;	//The number of layer for the ground is 12: so the mask will be 0000 0000 0000 0000 0001 0000 0000 0000
//	protected var groundAndChars: int = (1 << groundLayer) | (1 << playerLayer) | (1 << nonEnemiesLayer) | (1 << enemiesLayer);
	
	private var canBeHit: boolean = true;
	protected var killedAlready: boolean = false;
	protected var beenPhotographed : boolean = false;	//To keep track whether the microbe has been photographed or not 
	
	
	
	function Awake () {
	
		anim = gameObject.GetComponent(Animator);	//To store the animator component
		myTransform = transform;
		myGameObject = gameObject;
		myRigidbody2D = myTransform.rigidbody2D;
		
		var gameLogicGO : GameObject;
		gameLogicGO = GameObject.Find("GameLogic");
		if (gameLogicGO){
			//BE CAREFUL!! GameLogic is a GameObject that is created in the first scene and is never destroyed when changing between scenes!
			//That means that if this scene is played directly there will be here a null reference!!!!!!!
			goals = gameLogicGO.GetComponent("Goals");					//The Goals.js script is attached to the GameLogic gameobject. will be used to keep track of the goals of the level
		}																				
		else{
			Debug.LogError("GameLogic Object not found. This will be because GameLogic is created in the first level of the game, the GameShow level, and is intended to pass (be kept alive) throughout all the scenes in the game. So, if the Kitchen level is played, this object won't exist, and there must be many Null reference errors. But none of this errors will avoid playing the game. ");
		}
		
		microbeName = myTransform.gameObject.name;		//Here the name will be the name of the gameobject that this script is attached to. E.g. 00lucy
		microbeName = microbeName.Substring(2);					//to keep lucy instead of 00lucy
		
		canBeHit = true;
		killedAlready = false;
		beenPhotographed = false;
		
		iTween.Init(gameObject);					//Initializing iTween in order to avoid hiccups when first playing the movements
	
	}
	
	function Start () {
	
		
	
	}

	function Update () {
	
		//showMessages()
	
	}
	
	function FixedUpdate () {
	
		
	
	}
	
	//To detect the collisions with the player
	function OnCollisionEnter2D (coll: Collision2D) {
		if (canBeHit && coll.collider.gameObject.layer == utils.layers.player)
			beHit();

	}
	
	//This function will be called when a soap drop or a white blood cell hit is recieved
	function receiveDrop (dropName: String) {
		//Debug.Log(myTransform.name + ": Hit received. Name of drop: " + dropName);
		if (affectedBySoap && dropName == "soapDropThrow(Clone)"){
			life = life - soapDamage;
			Debug.Log(myTransform.name + ": Soap hit. Life: " + life);
			if (!killedAlready && life <= 0){
				goals.UpdateGoals(microbeName, "washed up");				//To inform the Goals.js script about the change
				beWashedAway();
				return;
			}
		}
		if (affectedByWhiteBC && dropName == "whiteBCellThrow(Clone)"){
			life = life - whiteBCDamage;
			Debug.Log(myTransform.name + ": whiteBC hit. Life: " + life);
			if (!killedAlready && life <= 0){
				goals.UpdateGoals(microbeName, "white blood cell");				//To inform the Goals.js script about the change
				beKilled();
				return;
			}
		}
		beHit();
	}
	
	//this function apply the effects of the antibiotics to this bug only if it's vulnerable to it
	function receiveAntibiotics(){
		
		if (affectedByAntibiotics) {
			beHit();
			life = life - antibioticsDamage;
			Debug.Log(myTransform.name + ": Antibiotics hit. Life: " + life);
			if (!killedAlready && life <= 0){
				goals.UpdateGoals(microbeName, "antibiotics");				//To inform the Goals.js script about the change
				beKilled();
				return;
			}
		}
		
	}
	
	//Called when a bug is photographed
	function bePhotographed () {
	
		anim.SetTrigger("be_photographed");
		if (!beenPhotographed){						//The goals will be update just with the first photo, not with the following
			beenPhotographed = true;
			goals.UpdateGoals(microbeName, "photo");				//To inform the Goals.js script about the change
		} 
		
	}
	
	//Called when a bug is hit
	function beHit () {
	
		anim.SetTrigger("be_hit");
		canBeHit = false;
		myRigidbody2D.AddForce(Vector2(0, 20));
//		yield new WaitForSeconds(0.1);
//		anim.ResetTrigger("be_hit");
		yield new WaitForSeconds(2);
		canBeHit = true;
	
	}
	
	//Called when a bug has been killed
	function beKilled () {
		if (!killedAlready){
			killedAlready = true;
			anim.SetTrigger("be_killed");
			//rigidbody2D.AddForce(Vector2(0, 20));
			rigidbody2D.gravityScale = 0;
			disableColliders();
			Destroy(gameObject, 1); //TODO Check this time
		}
	}
	
	//Called when a bug is washed away
	public function beWashedAway (): IEnumerator {
		
		if (!killedAlready){
			killedAlready = true;
			anim.SetTrigger("be_washed_away");
//			rigidbody2D.gravityScale = 0.01;
//			rigidbody2D.AddForce(Vector2(0, 20));

			//rigidbody2D.gravityScale = 0;
			rigidbody2D.isKinematic = true;
			disableColliders();
			
			iTween.MoveAdd(gameObject, {"y": 70, "time": 3, "easetype": EaseType.easeInQuart});	//, "oncomplete": "DestroyMicrobe"});
			
			//myTransform.localScale.x = Mathf.Lerp(myTransform.localScale.x, myTransform.localScale.x * 0.99, Time.deltaTime);
			//myTransform.localScale.y = Mathf.Lerp(myTransform.localScale.y, myTransform.localScale.y * 0.99, Time.deltaTime);
			
			Destroy(gameObject, 3); //TODO Check this time
		}
		
	}
	
	//This function triggers the debugMode to true during 1 frame each second. It is intended to show one frame per second the Debug messages. Use this way:
	//if (debugMode) Debug.log("Your message");
	//Very useful to display error messages in function that are executed many times per second.
	protected function showMessages(){
		timer += Time.deltaTime;
		debugMode = false;
		if (timer > 1){
			debugMode = true;
			timer = 0;
		}	
	}
	
	//To disable all the colliders of the microbe
	protected function disableColliders(){
		var colliders = GetComponents(Collider2D);// as Collider2D[];		//Cast from Object to Collider2D
		for (var myCollider : Collider2D in colliders) {
			myCollider.enabled = false;
		}
	
	}
	
}