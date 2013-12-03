#pragma strict

public class Microbe extends MonoBehaviour{
	
	/*Debug vars*/
	protected var debugMode: boolean = false;				//When true, this script displays all the Debug messages.
	protected var timer: float = 0;
	
	protected var anim: Animator;
	
	protected var myTransform: Transform;			//To keep the transform of the microbe
	protected var myGameObject: GameObject;
	protected var myRigidbody2D: Rigidbody2D;
	
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
	private var killedAlready: boolean = false;
	
	
	
	function Awake () {
	
		anim = gameObject.GetComponent(Animator);	//To store the animator component
		myTransform = transform;
		myGameObject = gameObject;
		myRigidbody2D = myTransform.rigidbody2D;
		canBeHit = true;
		killedAlready = false;
	
	}
	
	function Start () {
	
		
	
	}

	function Update () {
	
		//showMessages()
	
	}
	
	function FixedUpdate () {
	
		
	
	}
	
	function OnCollisionEnter2D (coll: Collision2D) {
		if (canBeHit && coll.collider.gameObject.layer == utils.layers.player)
			beHit();

	}
	
	function bePhotographed () {
	
		anim.SetTrigger("be_photographed");
	
	}

	function beHit () {
	
		anim.SetTrigger("be_hit");
		canBeHit = false;
		myRigidbody2D.AddForce(Vector2(0, 20));
//		yield new WaitForSeconds(0.1);
//		anim.ResetTrigger("be_hit");
		yield new WaitForSeconds(2);
		canBeHit = true;
	
	}
	
	function beKilled () {
		if (!killedAlready){
			killedAlready = true;
			anim.SetTrigger("be_killed");
			rigidbody2D.AddForce(Vector2(0, 20));
			Destroy(gameObject, 1); //TODO Check this time
		}
	}
	
	//This function triggers the debugMode to true during 1 frame each second. It is intended to show one frame per second the Debug messages. Use this way:
	//if (debugMode) Debug.log("Your message");
	protected function showMessages(){
		timer += Time.deltaTime;
		debugMode = false;
		if (timer > 1){
			debugMode = true;
			timer = 0;
		}	
	}
	
}