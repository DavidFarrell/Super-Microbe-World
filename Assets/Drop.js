#pragma strict

private var hasCollidedAlready: boolean = false;

function Start () {

	hasCollidedAlready = false;

}

function Update () {

}

function OnCollisionEnter2D (coll: Collision2D) {
	if(!hasCollidedAlready){
		hasCollidedAlready = true;
		Debug.Log("Soap drop: Collision against: " + coll.gameObject.name);
		
		//transform.collider2D.enabled = false;				//
		
		if (coll.gameObject.layer == utils.layers.enemies)
			coll.gameObject.SendMessage("beKilled");
		
		transform.GetComponent(Animator).SetTrigger("collide");
		
		Destroy(gameObject, 0.1);								//Destroys the drop 0.1 seconds after playing the "collision" animation
		
		hasCollidedAlready = true;
	}
}

// Disables the behaviour when it is invisible
function OnBecameInvisible () {
	Destroy(gameObject, 0.5);
}